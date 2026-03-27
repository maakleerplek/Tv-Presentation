/**
 * scrapers/news.js — Scrapes recent story articles from maakleerplek.be/verhalen/.
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

// ── Helpers ───────────────────────────────────────────────────────────────────

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

/**
 * Selectors tried in order when og:image is absent.
 * Earlier selectors are more specific and reliable.
 */
const BODY_IMAGE_SELECTORS = [
    '.wp-post-image',
    '.post-thumbnail img',
    '.elementor-post__thumbnail img',
    'article img',
    'main img',
    '.entry-content img',
];

/**
 * Extract the best available image URL from an article page's Cheerio instance.
 * Prefers og:image; falls back through a list of body-image selectors;
 * normalises http → https and relative → absolute.
 */
function extractImageUrl($a) {
    let imageUrl = $a('meta[property="og:image"]').attr('content') || '';

    if (!imageUrl) {
        for (const selector of BODY_IMAGE_SELECTORS) {
            const imgEl = $a(selector).first();
            if (imgEl.length > 0) {
                imageUrl =
                    imgEl.attr('data-src') ||
                    imgEl.attr('data-lazy-src') ||
                    imgEl.attr('data-srcset')?.split(',')[0].trim().split(' ')[0] ||
                    imgEl.attr('data-orig-file') ||
                    imgEl.attr('src') ||
                    '';
                if (imageUrl) break;
            }
        }
    }

    // Normalise protocol and make relative URLs absolute
    if (imageUrl.startsWith('http://')) {
        imageUrl = imageUrl.replace('http://', 'https://');
    } else if (imageUrl && !imageUrl.startsWith('https://') && imageUrl.startsWith('/')) {
        imageUrl = resolveMaakleerplekUrl(imageUrl);
    }

    return imageUrl;
}

/**
 * Parse a DD/MM/YYYY date string into an ISO 8601 string.
 * Returns an empty string if the format doesn't match.
 */
function parseDateStr(dateStr) {
    if (!dateStr) return '';
    const [d, m, y] = dateStr.split('/').map(Number);
    if (isNaN(d) || isNaN(m) || isNaN(y)) return '';
    return new Date(y, m - 1, d).toISOString();
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Scrape the maakleerplek.be stories archive and return an array of recent
 * articles, each enriched with description and image data from its detail page.
 * Results are cached for CACHE_DURATION_MS.
 */
export async function scrapeNews() {
    if (isCacheValid(newsCache, CACHE_DURATION_MS)) return newsCache.data;

    console.log('[News] Scraping', VERHALEN_URL);

    const response = await fetch(VERHALEN_URL, { headers: { 'User-Agent': USER_AGENT } });
    const html     = await response.text();
    const $        = cheerio.load(html);

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - NEWS_MAX_AGE_DAYS);

    // Collect article stubs from the archive list
    const stubs = [];
    $('article.archive_item').each((_, el) => {
        const titleEl = $(el).find('h3 a');
        const href    = titleEl.attr('href');
        const title   = titleEl.text().trim();
        const dateStr = $(el).find('p.date').text().trim(); // format: DD/MM/YYYY

        if (!href || !title) return;
        if (stubs.some(n => n.link === href)) return; // deduplicate

        stubs.push({ title, link: href, dateStr, modifiedTime: parseDateStr(dateStr) });
    });

    // Enrich each stub by visiting its article page
    const enrichedItems = [];
    for (const stub of stubs) {
        if (enrichedItems.length >= MAX_NEWS_ITEMS) break;

        // Skip articles older than the configured cutoff
        if (stub.modifiedTime && new Date(stub.modifiedTime) < cutoffDate) continue;

        try {
            const resp = await fetch(stub.link, { headers: { 'User-Agent': USER_AGENT } });
            if (!resp.ok) continue;

            const $a         = cheerio.load(await resp.text());
            const description =
                $a('meta[property="og:description"]').attr('content') ||
                $a('meta[name="description"]').attr('content') ||
                '';

            enrichedItems.push({
                ...stub,
                description: truncate(stripHtml(description), 200),
                imageUrl:    extractImageUrl($a),
                date:        stub.dateStr ||
                    (stub.modifiedTime ? new Date(stub.modifiedTime).toLocaleDateString('nl-BE') : ''),
            });
        } catch (err) {
            console.error(`[News] Failed to fetch details for ${stub.link}:`, err.message);
        }
    }

    newsCache = { data: enrichedItems, timestamp: Date.now() };
    console.log(`[News] Found ${enrichedItems.length} recent news items from /verhalen/`);
    return enrichedItems;
}
