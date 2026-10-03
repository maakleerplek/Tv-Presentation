/**
 * server.js — Express entry-point for the maakleerplek TV data-fetcher.
 *
 * This file is intentionally kept small: it only wires up Express routes and
 * delegates all scraping / data-fetching to purpose-built modules:
 *
 *   scrapers/calendar.js  — maakleerplek.be calendar
 *   scrapers/news.js      — maakleerplek.be story archive
 *   scrapers/pricing.js   — machine usage prices from InvenTree
 *   scrapers/drinks.js    — Inventree stock / drinks inventory
 *   categorise.js         — event classification (workshops vs recurring)
 *   config.js             — all environment-variable constants
 */

import express from 'express';
import cors    from 'cors';

// Global bypass for self-signed certificates (required for the local Inventree instance)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

import { scrapeCalendar } from './scrapers/calendar.js';
import { scrapeNews     } from './scrapers/news.js';
import { fetchMachinePricing } from './scrapers/pricing.js';
import { fetchDrinks, fetchWithTimeout } from './scrapers/drinks.js';
import { categoriseEvents } from './categorise.js';
import {
    MAAKLEERPLEK_URL,
    CAROUSEL_TRANSITION_TIME,
    TIPS_TRANSITION_TIME,
    STATUS_ROTATION_TIME,
    PAYMENT_QR_URL,
    STOCK_QR_URL,
    EVENT_PRIORITY,
    TIPS,
    INVENTREE_TOKEN,
    INVENTREE_URL,
} from './config.js';
import { isCacheValid } from './utils.js';

// ── Express setup ─────────────────────────────────────────────────────────────

const app = express();
app.use(cors());

// ── Transition state (for manual carousel-skip testing) ───────────────────────

let forceTransitionTime = Date.now();

// ── Routes ────────────────────────────────────────────────────────────────────

app.get('/api/calendar', async (_req, res) => {
    try {
        res.json(await scrapeCalendar());
    } catch (err) {
        console.error('[Calendar] Error:', err.message);
        res.status(500).json({ error: 'Failed to scrape calendar' });
    }
});

app.get('/api/news', async (_req, res) => {
    try {
        res.json(await scrapeNews());
    } catch (err) {
        console.error('[News] Error:', err.message);
        res.status(500).json({ error: 'Failed to scrape news' });
    }
});

app.get('/api/drinks', async (_req, res) => {
    try {
        res.json(await fetchDrinks());
    } catch (err) {
        console.error('[Drinks] Error:', err.message);
        res.status(500).json({ error: 'Failed to fetch drinks' });
    }
});

app.get('/api/screen-data', async (_req, res) => {
    try {
        // Fetch all data sources concurrently
        const [calendar, news, drinks, pricing] = await Promise.all([
            scrapeCalendar(),
            scrapeNews(),
            fetchDrinks(),
            fetchMachinePricing(),
        ]);

        const { workshops, recurringEvents } = categoriseEvents(calendar);
        const newsWithType = news.map(item => ({ ...item, type: 'news' }));

        // Log a summary so it's easy to see what the screen will display
        console.log('[ScreenData] Classification Summary:');
        console.log(`  --- News (${newsWithType.length} items) ---`);
        newsWithType.forEach((n, i) => console.log(`    ${i + 1}. [${n.date || '??'}] ${n.title}`));
        console.log(`  --- Workshops (${workshops.length} items) ---`);
        workshops.forEach((w, i) => console.log(`    ${i + 1}. [${w.dateISO} ${w.time || '??:??'}] ${w.title}${w.price ? ` (${w.price})` : ''}`));
        console.log(`  --- Recurring Events (${recurringEvents.length} items) ---`);
        recurringEvents.forEach((r, i) => console.log(`    ${i + 1}. [${r.dateISO} ${r.time || '??:??'}] ${r.title}`));

        res.json({
            workshops,
            news: newsWithType,
            recurringEvents,
            drinks,
            pricing,
            config: {
                transitionTime:     CAROUSEL_TRANSITION_TIME,
                tipsTransitionTime: TIPS_TRANSITION_TIME,
                statusRotationTime: STATUS_ROTATION_TIME,
                paymentQrUrl:       PAYMENT_QR_URL,
                stockQrUrl:          STOCK_QR_URL,
                eventPriority:      EVENT_PRIORITY,
                tips:               TIPS,
                websiteQrUrl:       MAAKLEERPLEK_URL,
            },
        });
    } catch (err) {
        console.error('[Screen-Data] Error:', err.message);
        res.status(500).json({ error: 'Failed to aggregate screen data' });
    }
});

// ── Image proxy (keeps Inventree token server-side) ───────────────────────────

// In-memory image cache: avoids re-fetching InvenTree on every Next.js optimizer request.
// Entries expire after 1 hour; bounded to 200 entries and 30 MB in total.
const IMAGE_CACHE_TTL_MS = 60 * 60 * 1000;
const IMAGE_CACHE_MAX = 200;
const IMAGE_CACHE_MAX_BYTES = 30 * 1024 * 1024;
const imageCache = new Map(); // url → { buf, contentType, cachedAt }
let imageCacheBytes = 0;

/** Only InvenTree's own files: the request carries the InvenTree token. */
function isInventreeUrl(url) {
    try {
        return new URL(url).origin === new URL(INVENTREE_URL).origin;
    } catch {
        return false;
    }
}

app.get('/api/proxy-image', async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl || typeof targetUrl !== 'string') return res.status(400).send('Missing url parameter');
    if (!isInventreeUrl(targetUrl)) return res.status(403).send('Only InvenTree images');

    const cached = imageCache.get(targetUrl);
    if (cached && (Date.now() - cached.cachedAt) < IMAGE_CACHE_TTL_MS) {
        res.setHeader('Content-Type', cached.contentType);
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.setHeader('X-Cache', 'HIT');
        return res.send(cached.buf);
    }

    try {
        const response = await fetchWithTimeout(targetUrl, {
            headers: { 'Authorization': `Token ${INVENTREE_TOKEN}` },
        }, 5000);
        if (!response.ok) return res.status(response.status).send(`Failed to fetch image: ${response.status}`);

        const contentType = response.headers.get('content-type') || 'image/jpeg';
        const buf = Buffer.from(await response.arrayBuffer());

        // Evict the oldest entries until the new one fits
        const old = imageCache.get(targetUrl);
        if (old) { imageCacheBytes -= old.buf.length; imageCache.delete(targetUrl); }
        while (imageCache.size > 0
               && (imageCache.size >= IMAGE_CACHE_MAX || imageCacheBytes + buf.length > IMAGE_CACHE_MAX_BYTES)) {
            const [k, v] = imageCache.entries().next().value;
            imageCacheBytes -= v.buf.length;
            imageCache.delete(k);
        }
        imageCache.set(targetUrl, { buf, contentType, cachedAt: Date.now() });
        imageCacheBytes += buf.length;
        console.log(`[Image Cache] MISS ${targetUrl.split('/').pop()} (${Math.round(buf.length / 1024)}kb, ${imageCache.size} entries)`);

        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.send(buf);
    } catch (err) {
        console.error('[Image Proxy] Error:', err.message);
        res.status(500).send('Error proxying image');
    }
});

// ── Health check ──────────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
});

// ── Manual transition trigger (for UI testing) ────────────────────────────────

app.get('/api/transition', (_req, res) => {
    forceTransitionTime = Date.now();
    console.log(`[Transition] Triggered at ${forceTransitionTime}`);
    res.json({ success: true, message: 'Transition triggered', timestamp: forceTransitionTime });
});

app.get('/api/transition/check', (_req, res) => {
    res.json({ forceTransitionTime });
});

// ── Start ─────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Data-fetcher listening on port ${PORT}`);
    // Pre-warm caches so the first real request is instant
    scrapeCalendar().catch(err => console.error('[Calendar] Pre-warm failed:', err.message));
    scrapeNews()    .catch(err => console.error('[News] Pre-warm failed:',     err.message));
    fetchDrinks()   .catch(err => console.error('[Drinks] Pre-warm failed:',   err.message));
});
