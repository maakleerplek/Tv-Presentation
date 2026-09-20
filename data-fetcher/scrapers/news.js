/**
 * scrapers/news.js — Scrapes recent story articles from maakleerplek.be/nl/verhalen.
 *
 * The September 2026 rebuild moved the site from WordPress to Next.js. The
 * archive is still server-rendered, and each card already carries everything
 * the screen needs — title, date, author, excerpt and image — so unlike the
 * old scraper we no longer visit every article page to fill in the blanks.
 *
 * Card shape:
 *   <a class="group block" href="/nl/verhalen/<slug>">
 *     <img srcSet="/_next/image?url=<encoded cdn url>&w=…">
 *     <span>Makers &amp; projecten</span>        ← category
 *     <h3>Title</h3>
 *     <p>18 september 2026 · Author</p>          ← date · byline
 *     <p>Excerpt…</p>
 *   </a>
 *
 * Exported: scrapeNews()
 */

import * as cheerio from 'cheerio';
import {
    VERHALEN_URL,
    CACHE_DURATION_MS,
    NEWS_MAX_AGE_DAYS,
    MAX_NEWS_ITEMS,
    resolveMaakleerplekUrl,
} from '../config.js';
import { truncate, stripHtml, isCacheValid } from '../utils.js';

// ── In-memory cache ───────────────────────────────────────────────────────────

let newsCache = { data: null, timestamp: 0 };
let inflightFetch = null;

// ── Helpers ───────────────────────────────────────────────────────────────────

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

/** Full Dutch month names as the story cards spell them. */
const DUTCH_MONTH_NAMES = [
    'januari', 'februari', 'maart', 'april', 'mei', 'juni',
    'juli', 'augustus', 'september', 'oktober', 'november', 'december',
];

/** The archive links to its own "share your story" form; it is not an article. */
const NON_ARTICLE_SLUGS = new Set(['delen']);

/**
 * Parse a long Dutch date such as "18 september 2026" into a Date.
 * Returns null when the string does not match.
 */
export function parseLongDutchDate(text) {
    const match = (text || '').toLowerCase().match(/(\d{1,2})\s+([a-zé]+)\s+(\d{4})/);
    if (!match) return null;

    const monthIndex = DUTCH_MONTH_NAMES.indexOf(match[2]);
    if (monthIndex === -1) return null;

    const date = new Date(Number(match[3]), monthIndex, Number(match[1]));
    return isNaN(date.getTime()) ? null : date;
}

/**
 * Recover the original CDN image URL from a Next.js image-optimiser `src`.
 * `/_next/image?url=https%3A%2F%2Fcdn…&w=828&q=75` → `https://cdn…`
 * Anything that is not an optimiser URL is returned unchanged.
 */
export function unwrapNextImage(src) {
    if (!src) return '';
    if (!src.includes('/_next/image')) return src;

    const encoded = src.match(/[?&]url=([^&]+)/);
    if (!encoded) return '';
    try {
        return decodeURIComponent(encoded[1]);
    } catch {
        return '';
    }
}

/** Pick the image for a card, preferring the plain `src` over the srcSet soup. */
function extractCardImage($card) {
    const img = $card.find('img').first();
    if (img.length === 0) return '';

    const src = img.attr('src') || img.attr('srcSet')?.split(',')[0].trim().split(' ')[0] || '';
    let imageUrl = unwrapNextImage(src);

    if (imageUrl.startsWith('http://')) {
        imageUrl = imageUrl.replace('http://', 'https://');
    } else if (imageUrl && !imageUrl.startsWith('https://')) {
        imageUrl = resolveMaakleerplekUrl(imageUrl.replace(/^\//, ''));
    }

    return imageUrl;
}

/**
 * Turn a rendered archive page into story items.
 * Exported so tests can feed it fixture HTML without touching the network.
 *
 * @param {string} html
 * @returns {Array<object>}
 */
export function parseNewsArchive(html) {
    const $ = cheerio.load(html);
    const items = [];

    $('a[href*="/verhalen/"]').each((_, el) => {
        const $card = $(el);
        const href = $card.attr('href') || '';

        const slug = href.split('/').filter(Boolean).pop()?.split('?')[0] || '';
        if (!slug || NON_ARTICLE_SLUGS.has(slug)) return;

        // A story card always has a heading; the "share your story" button does not.
        const title = $card.find('h3').first().text().trim();
        if (!title) return;

        const link = href.startsWith('http') ? href : resolveMaakleerplekUrl(href.replace(/^\//, ''));
        if (items.some(n => n.link === link)) return; // deduplicate

        // The first paragraph is "<date> · <author>", the second is the excerpt.
        const paragraphs = $card.find('p').map((_, p) => $(p).text().trim()).get();
        const [dateLine = '', excerpt = ''] = paragraphs;

        const [dateStr, author = ''] = dateLine.split('·').map(s => s.trim());
        const published = parseLongDutchDate(dateStr);

        items.push({
            title,
            link,
            author,
            category:     $card.find('span').first().text().trim(),
            dateStr:      dateStr || '',
            date:         dateStr || '',
            modifiedTime: published ? published.toISOString() : '',
            description:  truncate(stripHtml(excerpt), 1500),
            imageUrl:     extractCardImage($card),
        });
    });

    return items;
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Scrape the maakleerplek.be stories archive and return the most recent
 * articles. Results are cached for CACHE_DURATION_MS.
 */
export async function scrapeNews() {
    if (isCacheValid(newsCache, CACHE_DURATION_MS)) return newsCache.data;

    if (newsCache.data && !inflightFetch) {
        inflightFetch = doFetch().finally(() => { inflightFetch = null; });
        return newsCache.data;
    }
    if (inflightFetch) return inflightFetch;
    inflightFetch = doFetch().finally(() => { inflightFetch = null; });
    return inflightFetch;
}

async function doFetch() {
    console.log('[News] Scraping', VERHALEN_URL);

    let items;
    try {
        const response = await fetch(VERHALEN_URL, { headers: { 'User-Agent': USER_AGENT } });
        if (!response.ok) {
            console.error(`[News] Archive fetch failed: ${response.status}, skipping cache update`);
            return newsCache.data ?? [];
        }
        items = parseNewsArchive(await response.text());
    } catch (err) {
        console.error('[News] Archive fetch threw:', err.message, '— skipping cache update');
        return newsCache.data ?? [];
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - NEWS_MAX_AGE_DAYS);

    const recent = items
        .filter(item => item.modifiedTime && new Date(item.modifiedTime) >= cutoffDate)
        .sort((a, b) => b.modifiedTime.localeCompare(a.modifiedTime))
        .slice(0, MAX_NEWS_ITEMS);

    if (recent.length > 0) newsCache = { data: recent, timestamp: Date.now() };

    console.log(`[News] Found ${recent.length} recent news items out of ${items.length} on /verhalen`);
    return recent;
}
