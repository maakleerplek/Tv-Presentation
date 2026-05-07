/**
 * scrapers/calendar.js — Fetches upcoming events from the maakleerplek WP REST API.
 *
 * The legacy HTML scraper used `.agenda_element` CSS classes, but the calendar
 * page switched to a JS-rendered layout. The WP REST API exposes a `kalender`
 * custom post type with all event data in ACF fields, so we use that instead.
 */

import { MAAKLEERPLEK_URL, CACHE_DURATION_MS } from '../config.js';
import { isCacheValid } from '../utils.js';

// ── In-memory cache ───────────────────────────────────────────────────────────

let calendarCache = { data: null, timestamp: 0 };

// ── Constants ─────────────────────────────────────────────────────────────────

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

const BASE = MAAKLEERPLEK_URL ? MAAKLEERPLEK_URL.origin : 'https://maakleerplek.be';
const API_BASE = `${BASE}/wp-json/wp/v2/kalender`;
const FIELDS = '_fields=id,title,link,excerpt,acf,featured_media';
const MEDIA_API = `${BASE}/wp-json/wp/v2/media`;

const DUTCH_DAYS   = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
const DUTCH_MONTHS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

// ── Helpers ───────────────────────────────────────────────────────────────────

/** "20260507" → "2026-05-07" */
function datumToISO(datum) {
    return `${datum.slice(0, 4)}-${datum.slice(4, 6)}-${datum.slice(6, 8)}`;
}

/** "20260507" → "do 7 mei" */
function datumToDutch(datum) {
    const y = parseInt(datum.slice(0, 4), 10);
    const m = parseInt(datum.slice(4, 6), 10) - 1;
    const d = parseInt(datum.slice(6, 8), 10);
    const dow = new Date(y, m, d).getDay();
    return `${DUTCH_DAYS[dow]} ${d} ${DUTCH_MONTHS[m]}`;
}

/** Fetch one page; return { items, totalPages }. */
async function fetchPage(page) {
    const url = `${API_BASE}?per_page=100&page=${page}&${FIELDS}`;
    try {
        const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
        if (!res.ok) return { items: [], totalPages: 1 };
        const totalPages = parseInt(res.headers.get('X-WP-TotalPages') || '1', 10);
        const items = await res.json();
        return { items: Array.isArray(items) ? items : [], totalPages };
    } catch (err) {
        console.warn(`[Calendar] Page ${page} fetch failed:`, err.message);
        return { items: [], totalPages: 1 };
    }
}

/**
 * Batch-fetch image URLs for a set of media IDs.
 * Returns a Map<id, source_url>.
 */
async function fetchMediaMap(mediaIds) {
    const unique = [...new Set(mediaIds.filter(Boolean))];
    if (unique.length === 0) return new Map();

    // WP REST API supports up to 100 items per request via `include`
    const chunks = [];
    for (let i = 0; i < unique.length; i += 100) chunks.push(unique.slice(i, i + 100));

    const results = await Promise.all(chunks.map(async chunk => {
        const url = `${MEDIA_API}?include=${chunk.join(',')}&per_page=100&_fields=id,source_url`;
        try {
            const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
            if (!res.ok) return [];
            return await res.json();
        } catch {
            return [];
        }
    }));

    const map = new Map();
    results.flat().forEach(m => { if (m.id && m.source_url) map.set(m.id, m.source_url); });
    console.log(`[Calendar] Resolved ${map.size}/${unique.length} media images`);
    return map;
}

/** Map a single WP REST API item to our CalendarEvent shape. */
function mapItem(item, mediaMap) {
    const acf   = item.acf || {};
    const datum = (acf.datum || '').toString().trim();
    if (datum.length !== 8 || !/^\d{8}$/.test(datum)) return null;

    // Normalise time: "18:00-22:00" or "18:00 - 22:00" → "18:00 - 22:00"
    const time = (acf.uur || '').replace(/\s*[-–]\s*/, ' - ').trim();

    // Price: ACF stores it as a number (5) or empty string
    const priceRaw = acf.prijs;
    const price = priceRaw && String(priceRaw).trim() ? `€${priceRaw}` : '';

    // Featured image from the pre-fetched media map
    const imageUrl = (item.featured_media && mediaMap.get(item.featured_media)) || '';

    // Description from excerpt (strip HTML)
    const description = (item.excerpt?.rendered || '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim();

    return {
        title:       (item.title?.rendered || '').trim(),
        location:    'maakleerplek',
        time,
        date:        datumToDutch(datum),
        dateISO:     datumToISO(datum),
        link:        item.link || '',
        description,
        imageUrl,
        price,
    };
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function scrapeCalendar() {
    if (isCacheValid(calendarCache, CACHE_DURATION_MS)) return calendarCache.data;

    console.log('[Calendar] Fetching from WP REST API', API_BASE);

    // First page gives us the total page count
    const { items: firstItems, totalPages } = await fetchPage(1);

    // Fetch all remaining pages concurrently
    const extraPages = Array.from({ length: Math.max(0, totalPages - 1) }, (_, i) => i + 2);
    const extraResults = await Promise.all(extraPages.map(fetchPage));
    const allItems = [...firstItems, ...extraResults.flatMap(r => r.items)];

    // Filter to upcoming events only
    const today = new Date();
    const todayStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;

    const upcomingItems = allItems.filter(item => {
        const datum = (item.acf?.datum || '').toString().trim();
        return datum.length === 8 && datum >= todayStr;
    });

    // Batch-fetch all unique media images in parallel with no extra per-event requests
    const mediaIds = upcomingItems.map(item => item.featured_media).filter(Boolean);
    const mediaMap = await fetchMediaMap(mediaIds);

    const events = upcomingItems
        .map(item => mapItem(item, mediaMap))
        .filter(e => e && e.title)
        .sort((a, b) => a.dateISO.localeCompare(b.dateISO));

    calendarCache = { data: events, timestamp: Date.now() };

    console.log(`[Calendar] Fetched ${events.length} upcoming events from ${totalPages} pages:`);
    events.slice(0, 15).forEach((e, i) =>
        console.log(`  ${i + 1}. [${e.dateISO} ${e.time || '??:??'}] ${e.title}`)
    );

    return events;
}
