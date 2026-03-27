/**
 * config.js — Single source of truth for all data-fetcher configuration.
 *
 * Reads environment variables (with sensible defaults) and exports typed
 * constants consumed by scrapers and the Express server.  Nothing in here
 * makes network calls or has side-effects beyond reading `process.env`.
 */

import { MAAKLEERPLEK_URL as MAAKLEERPLEK_URL_CONFIG } from './scraper-config.js';

// ── Base URL ─────────────────────────────────────────────────────────────────

const MAAKLEERPLEK_URL_RAW = (
    process.env.MAAKLEERPLEK_URL ||
    MAAKLEERPLEK_URL_CONFIG ||
    'https://maakleerplek.be'
).replace(/\/$/, '');

/** Parsed URL object, or null if the raw string is not a valid URL. */
export const MAAKLEERPLEK_URL = (() => {
    try {
        return new URL(MAAKLEERPLEK_URL_RAW);
    } catch {
        console.warn('[Config] MAAKLEERPLEK_URL is invalid, falling back to plain string:', MAAKLEERPLEK_URL_RAW);
        return null;
    }
})();

/**
 * Resolve a path relative to the configured maakleerplek base URL,
 * preserving any query-string parameters (e.g. Google Translate params).
 */
export function resolveMaakleerplekUrl(path = '') {
    if (!MAAKLEERPLEK_URL) {
        const sanitizedPath = path.replace(/^\/+/, '');
        return sanitizedPath ? `${MAAKLEERPLEK_URL_RAW}/${sanitizedPath}` : MAAKLEERPLEK_URL_RAW;
    }

    const resolved = new URL(path, MAAKLEERPLEK_URL);
    // Carry over any base-URL search params (e.g. ?_x_tr_sl=nl&_x_tr_tl=en)
    if (MAAKLEERPLEK_URL.search) resolved.search = MAAKLEERPLEK_URL.search;
    return resolved.href;
}

// ── Resolved endpoint URLs ────────────────────────────────────────────────────

export const CALENDAR_URL = resolveMaakleerplekUrl('kalender/');
export const VERHALEN_URL  = resolveMaakleerplekUrl('verhalen/');
export const HOMEPAGE_URL  = resolveMaakleerplekUrl('');

// ── Cache durations ───────────────────────────────────────────────────────────

/** General scraper cache lifetime (ms). Default: 15 minutes. */
export const CACHE_DURATION_MS = parseInt(process.env.CACHE_DURATION_MINUTES || '15', 10) * 60 * 1000;

/** Drinks cache lifetime (ms). Default: 5 minutes (stock changes more often). */
export const DRINKS_CACHE_DURATION_MS = parseInt(process.env.DRINKS_CACHE_DURATION_MINUTES || '5', 10) * 60 * 1000;

// ── Event / news limits ───────────────────────────────────────────────────────

/** Maximum age (days) for a news article to be included. */
export const NEWS_MAX_AGE_DAYS = parseInt(process.env.NEWS_MAX_AGE_DAYS || '14', 10);

/** Maximum number of news articles to return. */
export const MAX_NEWS_ITEMS = parseInt(process.env.MAX_NEWS_ITEMS || '6', 10);

/** Maximum number of events for which to fetch detail pages. */
export const MAX_EVENT_DETAILS = parseInt(process.env.MAX_EVENT_DETAILS || '30', 10);

// ── Event categorisation keywords ─────────────────────────────────────────────

/**
 * Comma-separated priority keywords (e.g. "openlab,repair,young maker").
 * Events whose title contains an earlier keyword beat those with a later one.
 */
export const EVENT_PRIORITY = (process.env.EVENT_PRIORITY || '')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

/** Title keywords that identify a paid workshop or training session. */
export const WORKSHOP_KEYWORDS = ['workshop', 'initiatie', 'cursus', 'opleiding', 'naailes', 'leren', '3d-print'];

/** Title keywords that identify a recurring free/community service event. */
export const RECURRING_SERVICE_KEYWORDS = ['open lab', 'repair', 'gereedschappenbib', 'buurtkantine', 'herstel hub', 'geopend'];

// ── Frontend display timings ──────────────────────────────────────────────────

/** Seconds each carousel slide is shown before the next one appears. */
export const CAROUSEL_TRANSITION_TIME = parseInt(process.env.CAROUSEL_TRANSITION_TIME || '15', 10);

/** Seconds each tip in the footer is shown. */
export const TIPS_TRANSITION_TIME = parseInt(process.env.TIPS_TRANSITION_TIME || '10', 10);

/** Seconds the status block rotates between "Next Event" and "Next Workshop". */
export const STATUS_ROTATION_TIME = parseInt(process.env.STATUS_ROTATION_TIME || '10', 10);

// ── QR / link URLs ────────────────────────────────────────────────────────────

/** URL encoded into the payment QR code in the drinks panel. */
export const PAYMENT_QR_URL = process.env.PAYMENT_QR_URL || '';

/** URL encoded into the wiki QR code in the tips footer. */
export const WIKI_QR_URL = process.env.WIKI_QR_URL || 'https://wiki.maakleerplek.be/en/hightechlab';

// ── Rotating footer tips ──────────────────────────────────────────────────────

/**
 * Numbered tips read from TIP_1, TIP_2, TIP_3, … env vars.
 * Collection stops at the first missing index.
 */
export const TIPS = (() => {
    const tips = [];
    for (let i = 1; ; i++) {
        const val = process.env[`TIP_${i}`];
        if (!val) break;
        tips.push(val.trim());
    }
    return tips;
})();

// ── Inventree (drinks) ────────────────────────────────────────────────────────

export const INVENTREE_URL   = process.env.INVENTREE_URL   || 'https://10.72.3.68:8443';
export const INVENTREE_TOKEN = process.env.INVENTREE_TOKEN;

/**
 * One or more Inventree stock-location names to filter by.
 * Supports a comma-separated list, e.g. "HTL-fridge,HTL-snacks".
 * Falls back to the singular INVENTREE_DRINKS_LOCATION for backwards compatibility.
 */
export const INVENTREE_DRINKS_LOCATIONS = (
    process.env.INVENTREE_DRINKS_LOCATIONS || process.env.INVENTREE_DRINKS_LOCATION || ''
).split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
