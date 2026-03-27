/**
 * fetchEventDetail — scrapes a single maakleerplek.be event page for
 * extra metadata: description, imageUrl, time, location, price.
 *
 * Extracted into its own module so it can be unit-tested independently
 * of the Express server.
 */
import * as cheerio from 'cheerio';
import { stripHtml, truncate } from './utils.js';
import { resolveMaakleerplekUrl } from './config.js';

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
        return parseEventDetailHtml(html, url);
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
 * @param {string} [url] Optional URL for logging context
 * @returns {{description:string, imageUrl:string, time:string, location:string, price:string}}
 */
export function parseEventDetailHtml(html, url = 'unknown') {
    const $ = cheerio.load(html);

    // ── Description ────────────────────────────────────────────────
    let description = $('meta[property="og:description"]').attr('content') || 
                      $('meta[name="description"]').attr('content') || '';
    
    // Fallback: use first paragraph of content if no meta description
    if (!description) {
        const firstP = $('article p').first().text().trim();
        if (firstP) {
            description = firstP;
            console.log(`[Scraper] Found fallback description for ${url} in article body`);
        }
    }

    if (!description) {
        console.warn(`[Scraper] Missing description for ${url}`);
    }

    // ── Image ──────────────────────────────────────────────────────
    // og:image is the most reliable; images on this site use http:// — normalise to https://
    const ogImage = $('meta[property="og:image"]').attr('content');
    
    // Select candidates for body image
    const bodyImages = [
        '.wp-post-image',
        '.post-thumbnail img',
        '.elementor-post__thumbnail img',
        'article img',
        'main img',
        '.entry-content img'
    ];
    
    let imageUrl = ogImage || '';
    
    if (!imageUrl) {
        for (const selector of bodyImages) {
            const imgEl = $(selector).first();
            if (imgEl.length > 0) {
                // Check multiple sources (standard src, lazy-loading data-src, data-srcset, etc.)
                imageUrl = imgEl.attr('data-src') || 
                           imgEl.attr('data-lazy-src') || 
                           imgEl.attr('data-srcset')?.split(',')[0].trim().split(' ')[0] ||
                           imgEl.attr('data-orig-file') || 
                           imgEl.attr('src') || '';
                if (imageUrl) {
                    console.log(`[Scraper] Found fallback image for ${url} via ${selector}`);
                    break;
                }
            }
        }
    }

    if (!imageUrl) {
        console.warn(`[Scraper] Missing image for ${url}`);
    }

    // Normalise URL: http → https, relative → absolute
    if (imageUrl.startsWith('http://')) {
        imageUrl = imageUrl.replace('http://', 'https://');
    } else if (imageUrl && !imageUrl.startsWith('https://') && imageUrl.startsWith('/')) {
        imageUrl = resolveMaakleerplekUrl(imageUrl);
    } else if (imageUrl && !imageUrl.startsWith('http')) {
        imageUrl = resolveMaakleerplekUrl(imageUrl);
    }

    // ── Time extraction ────────────────────────────────────────────
    let time = '';
    const timeIcon = $('img[src*="icon-time.svg"], img[data-src*="icon-time.svg"]');
    if (timeIcon.length > 0) {
        const parentText = timeIcon.closest('p').text().trim();
        // Match range: "10:00-13:00" or "10:00 - 13:00"
        const timeMatch = parentText.match(/\d{1,2}[:.]\d{2}\s*[-–]\s*\d{1,2}[:.]\d{2}/);
        if (timeMatch) {
            time = timeMatch[0].replace(/\./g, ':');
        } else {
            // Match single time: "10:00" (avoid matching dates like 28/02/2026)
            const token = parentText.match(/(?<!\d{2}\/\d{2}\/\d{4}\s)(\d{1,2}[:.]\d{2})/);
            if (token) time = token[0].replace(/\./g, ':');
        }
    }

    // Fallback: search main body for time patterns
    if (!time) {
        const bodyText = $('main').text();
        const timeMatch = bodyText.match(/\d{1,2}[:.]\d{2}\s*[-–]\s*\d{1,2}[:.]\d{2}/);
        if (timeMatch) time = timeMatch[0].replace(/\./g, ':');
    }

    if (!time) {
        console.warn(`[Scraper] Missing time for ${url}`);
    }

    // ── Location extraction ────────────────────────────────────────
    const locationIcon = $('img[src*="icon-location.svg"], img[data-src*="icon-location.svg"]');
    let location = '';
    if (locationIcon.length > 0) {
        const rawLoc = locationIcon.closest('p').text().trim();
        location = stripHtml(rawLoc).replace(/^Locatie\s*/i, '').trim();
    }

    if (!location) {
        // Fallback: look for common location-sounding strings or specific labs
        const labs = ['High Tech Lab', 'TextielLab', 'Grafisch Lab', 'HoutLab', 'Maakbar', 'Elektro Herstel Hub'];
        const bodyText = $('main').text();
        for (const lab of labs) {
            if (bodyText.includes(lab)) {
                location = lab;
                console.log(`[Scraper] Found fallback location for ${url}: ${lab}`);
                break;
            }
        }
    }

    if (!location) {
        console.warn(`[Scraper] Missing location for ${url}`);
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
