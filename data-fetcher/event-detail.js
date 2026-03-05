/**
 * fetchEventDetail — scrapes a single maakleerplek.be event page for
 * extra metadata: description, imageUrl, time, location, price.
 *
 * Extracted into its own module so it can be unit-tested independently
 * of the Express server.
 */
import * as cheerio from 'cheerio';
import { stripHtml, truncate } from './utils.js';

const MAAKLEERPLEK_URL = (process.env.MAAKLEERPLEK_URL || 'https://maakleerplek.be').replace(/\/$/, '');

/**
 * @param {string} url  Absolute URL of the event detail page.
 * @param {function} [fetchFn]  Optional fetch override (used in tests to inject mock HTML).
 * @returns {Promise<{description:string, imageUrl:string, time:string, location:string, price:string}>}
 */
export async function fetchEventDetail(url, fetchFn = fetch) {
    try {
        const response = await fetchFn(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        if (!response.ok) {
            console.error(`[fetchEventDetail] Failed ${url}: ${response.status}`);
            return {};
        }
        const html = await response.text();
        return parseEventDetailHtml(html);
    } catch (err) {
        console.error(`[fetchEventDetail] Exception for ${url}:`, err.message);
        return {};
    }
}

/**
 * Parse a raw event-detail HTML string.
 * Exported separately so tests can call it directly without needing fetch.
 *
 * @param {string} html
 * @returns {{description:string, imageUrl:string, time:string, location:string, price:string}}
 */
export function parseEventDetailHtml(html) {
    const $ = cheerio.load(html);

    const description = $('meta[property="og:description"]').attr('content') || '';

    // og:image is the most reliable; images on this site use http:// — normalise to https://
    let imageUrl = $('meta[property="og:image"]').attr('content') ||
        $('.wp-post-image').attr('src') ||
        $('.post-thumbnail img').attr('src') ||
        $('article img').first().attr('src') ||
        $('main img').first().attr('src') || '';

    // Normalise URL: http → https, relative → absolute
    if (imageUrl.startsWith('http://')) {
        imageUrl = imageUrl.replace('http://', 'https://');
    } else if (imageUrl && !imageUrl.startsWith('https://') && imageUrl.startsWith('/')) {
        imageUrl = `${MAAKLEERPLEK_URL}${imageUrl}`;
    } else if (imageUrl && !imageUrl.startsWith('http')) {
        imageUrl = `${MAAKLEERPLEK_URL}/${imageUrl}`;
    }

    // ── Time extraction ────────────────────────────────────────────
    let time = '';
    const timeIcon = $('img[src*="icon-time.svg"], img[data-src*="icon-time.svg"]');
    if (timeIcon.length > 0) {
        const parentText = timeIcon.closest('p').text().trim();
        const timeMatch = parentText.match(/\d{1,2}[:.]\d{2}\s*[-–]\s*\d{1,2}[:.]\d{2}/);
        if (timeMatch) {
            time = timeMatch[0].replace(/\./g, ':');
        } else {
            const token = parentText.match(/(?<!\d{2}\/\d{2}\/\d{4}\s)(\d{1,2}[:.]\d{2})/);
            if (token) time = token[0].replace(/\./g, ':');
        }
    }

    if (!time) {
        const bodyText = $('main').text();
        const timeMatch = bodyText.match(/\d{1,2}[:.]\d{2}\s*[-–]\s*\d{1,2}[:.]\d{2}/);
        if (timeMatch) time = timeMatch[0].replace(/\./g, ':');
    }

    // ── Location extraction ────────────────────────────────────────
    const locationIcon = $('img[src*="icon-location.svg"], img[data-src*="icon-location.svg"]');
    let location = '';
    if (locationIcon.length > 0) {
        const rawLoc = locationIcon.closest('p').text().trim();
        location = stripHtml(rawLoc).replace(/^Locatie\s*/i, '').trim();
    }

    // ── Price extraction ───────────────────────────────────────────
    let price = '';
    const priceIcon = $(
        'img[src*="icon-price.svg"], img[data-src*="icon-price.svg"],' +
        'img[src*="icon-ticket.svg"], img[data-src*="icon-ticket.svg"],' +
        'img[src*="icon-euro.svg"], img[data-src*="icon-euro.svg"]'
    );
    if (priceIcon.length > 0) {
        const rawPrice = priceIcon.closest('p').text().trim();
        price = stripHtml(rawPrice).replace(/^(Prijs|Price)\s*/i, '').trim();
    }

    // Fallback: scan main for a € amount
    if (!price) {
        const metaText = $('main').text();
        const euroMatch = metaText.match(/€\s*\d+([.,]\d{1,2})?/);
        if (euroMatch) price = euroMatch[0].replace(/\s+/g, '');
    }

    return {
        description: truncate(stripHtml(description), 400),
        imageUrl,
        time,
        location,
        price,
    };
}
