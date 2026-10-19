/**
 * fetchEventDetail — reads a single maakleerplek.be event page for
 * extra metadata: description, imageUrl, time, location, price.
 *
 * The site publishes a schema.org `Event` block as JSON-LD on every event
 * page, which carries exactly the fields we need. We read that first and
 * only fall back to the Open Graph tags when it is missing or malformed.
 *
 * Extracted into its own module so it can be unit-tested independently
 * of the Express server.
 */
import * as cheerio from 'cheerio';
import { stripHtml, truncate } from './utils.js';
import { resolveMaakleerplekUrl } from './config.js';

/**
 * The event text as the site shows it (`article .prose`), as plain text the TV
 * formats: paragraphs split by a blank line, <br> as a line break, list items
 * as "- " / "1. " lines and <strong>/<b> as **bold**.
 */
export function proseToText($, el) {
    const inline = node => $(node).contents().map((_, c) => {
        if (c.type === 'text') return c.data;
        if (c.name === 'br') return '\n';
        const inner = inline(c);
        return (c.name === 'strong' || c.name === 'b') && inner.trim() ? `**${inner.trim()}**` : inner;
    }).get().join('');
    const clean = t => t.split('\n').map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');

    const blocks = [];
    $(el).children().each((_, c) => {
        if (c.name === 'ul' || c.name === 'ol') {
            const lines = $(c).children('li').map((i, li) => `${c.name === 'ol' ? `${i + 1}.` : '-'} ${clean(inline(li)).replace(/\n/g, ' ')}`).get();
            if (lines.length) blocks.push(lines.join('\n'));
        } else {
            const text = clean(inline(c));
            if (text) blocks.push(text);
        }
    });
    return blocks.join('\n\n');
}

/** Times on the site are local to the venue, JSON-LD publishes them in UTC. */
const SITE_TIMEZONE = 'Europe/Brussels';

/**
 * @param {string} url  Absolute URL of the event detail page.
 * @param {function} [fetchFn]  Optional fetch override (used in tests to inject mock HTML).
 * @returns {Promise<{description:string, imageUrl:string, time:string, location:string, price:string}>}
 */
export async function fetchEventDetail(url, fetchFn = fetch) {
    try {
        const response = await fetchFn(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            signal: AbortSignal.timeout(10_000),
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
 * Pull every JSON-LD block out of a page and return the first one whose
 * `@type` matches. Handles `@graph` wrappers and top-level arrays, and
 * silently skips blocks that fail to parse.
 *
 * @param {import('cheerio').CheerioAPI} $
 * @param {string} type  e.g. 'Event' or 'Article'
 * @returns {object|null}
 */
export function findJsonLd($, type) {
    const nodes = [];

    $('script[type="application/ld+json"]').each((_, el) => {
        const raw = $(el).contents().text().trim();
        if (!raw) return;
        try {
            const parsed = JSON.parse(raw);
            const items = Array.isArray(parsed) ? parsed : [parsed];
            for (const item of items) {
                if (Array.isArray(item?.['@graph'])) nodes.push(...item['@graph']);
                else nodes.push(item);
            }
        } catch {
            // A malformed block is not worth failing the whole page over.
        }
    });

    return nodes.find(n => n?.['@type'] === type) || null;
}

/**
 * Format an ISO timestamp as "HH:MM" in the venue's timezone.
 * Returns an empty string for anything unparseable.
 */
function toLocalTime(iso) {
    if (!iso) return '';
    const date = new Date(iso);
    if (isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('nl-BE', {
        hour: '2-digit', minute: '2-digit', hour12: false, timeZone: SITE_TIMEZONE,
    }).format(date);
}

/** True when both timestamps fall on the same calendar day in the venue's timezone. */
function sameLocalDay(startIso, endIso) {
    const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: SITE_TIMEZONE });
    try {
        return fmt.format(new Date(startIso)) === fmt.format(new Date(endIso));
    } catch {
        return false;
    }
}

/**
 * Render a schema.org `offers` block as the "€30" string the frontend expects.
 * Free events return an empty string, matching how the old WordPress scraper
 * left the price blank when no amount was set.
 */
function formatPrice(event) {
    if (event.isAccessibleForFree === true) return '';

    const offers = Array.isArray(event.offers) ? event.offers[0] : event.offers;
    const amount = offers?.price;
    if (amount === undefined || amount === null || amount === '') return '';

    const numeric = Number(amount);
    if (isNaN(numeric) || numeric <= 0) return '';

    // Whole euros stay whole; anything else keeps two decimals.
    return `€${Number.isInteger(numeric) ? numeric : numeric.toFixed(2)}`;
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
    const event = findJsonLd($, 'Event');

    // ── Description ────────────────────────────────────────────────
    // The page's own text keeps its paragraphs and lists; JSON-LD and og: are one run of text.
    const prose = $('article .prose').first();
    const proseText = prose.length ? proseToText($, prose) : '';
    let description =
        proseText ||
        event?.description ||
        $('meta[property="og:description"]').attr('content') ||
        $('meta[name="description"]').attr('content') ||
        '';

    if (!description) {
        const firstP = $('article p').first().text().trim();
        if (firstP) {
            description = firstP;
            console.log(`[Scraper] Found fallback description for ${url} in article body`);
        }
    }

    if (!description) console.warn(`[Scraper] Missing description for ${url}`);

    // ── Image ──────────────────────────────────────────────────────
    const jsonLdImage = Array.isArray(event?.image) ? event.image[0] : event?.image;
    let imageUrl =
        (typeof jsonLdImage === 'string' ? jsonLdImage : jsonLdImage?.url) ||
        $('meta[property="og:image"]').attr('content') ||
        '';

    if (!imageUrl) console.warn(`[Scraper] Missing image for ${url}`);

    // Normalise URL: http → https, relative → absolute
    if (imageUrl.startsWith('http://')) {
        imageUrl = imageUrl.replace('http://', 'https://');
    } else if (imageUrl && !imageUrl.startsWith('https://')) {
        imageUrl = resolveMaakleerplekUrl(imageUrl);
    }

    // ── Time ───────────────────────────────────────────────────────
    // Recurring events publish the *series* end date, which would render as a
    // nonsense range, so an end that lands on another day is dropped.
    const start = toLocalTime(event?.startDate);
    const end = event?.endDate && sameLocalDay(event.startDate, event.endDate)
        ? toLocalTime(event.endDate)
        : '';

    let time = start && end ? `${start} - ${end}` : start;

    if (!time) {
        const bodyText = $('main').text();
        const timeMatch = bodyText.match(/\d{1,2}[:.]\d{2}\s*[-–]\s*\d{1,2}[:.]\d{2}/);
        if (timeMatch) time = timeMatch[0].replace(/\./g, ':').replace(/\s*[-–]\s*/, ' - ');
    }

    if (!time) console.warn(`[Scraper] Missing time for ${url}`);

    // ── Location ───────────────────────────────────────────────────
    // "maakleerplek — High Tech Lab" → "High Tech Lab"
    const placeName = event?.location?.name || '';
    const location = placeName.split('—').pop().trim();

    if (!location) console.warn(`[Scraper] Missing location for ${url}`);

    // ── Price ──────────────────────────────────────────────────────
    let price = event ? formatPrice(event) : '';

    if (!price && !event) {
        const euroMatch = $('main').text().match(/€\s*\d+([.,]\d{1,2})?/);
        if (euroMatch) price = euroMatch[0].replace(/\s+/g, '');
    }

    return {
        description: truncate(proseText ? description : stripHtml(description), 1500),
        imageUrl,
        time,
        location,
        price,
    };
}
