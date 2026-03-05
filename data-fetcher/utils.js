/**
 * Pure utility functions shared between server.js and tests.
 * No Express, no network calls, no side-effects.
 */

// ── Dutch month abbreviation → month index ──────────────────────
export const DUTCH_MONTHS = {
    jan: 0, feb: 1, maa: 2, mrt: 2, apr: 3, mei: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, okt: 9, nov: 10, dec: 11,
};

/**
 * Parse a Dutch short date like "do 26 feb" into a Date object.
 * Uses the current year, or next year if the date is more than
 * 60 days in the past.
 * Returns null on parse failure.
 */
export function parseDutchDate(text) {
    const cleaned = text.trim().toLowerCase();
    const match = cleaned.match(/\w+\s+(\d+)\s+(\w+)/);
    if (!match) return null;

    const day = parseInt(match[1], 10);
    const monthKey = match[2].substring(0, 3);
    const monthIndex = DUTCH_MONTHS[monthKey];
    if (monthIndex === undefined) return null;

    const now = new Date();
    const year = now.getFullYear();
    const date = new Date(year, monthIndex, day);

    // If date is more than 60 days in the past, assume next year
    if (date < new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)) {
        date.setFullYear(year + 1);
    }

    return date;
}

/** Strip HTML tags from a string. */
export function stripHtml(str) {
    return str.replace(/<[^>]*>/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

/** Truncate a string to maxLen characters, adding ellipsis if needed. */
export function truncate(str, maxLen) {
    if (!str || str.length <= maxLen) return str;
    return str.slice(0, maxLen).trimEnd() + '…';
}

/**
 * Determine whether a cache object is still valid.
 * @param {{ data: any, timestamp: number }} cache
 * @param {number} duration  Max age in ms
 */
export function isCacheValid(cache, duration) {
    return !!(cache.data && (Date.now() - cache.timestamp < duration));
}

/**
 * Score a recurring-event candidate for best-instance selection.
 * Returns -Infinity for in-progress events (highest priority),
 * +Infinity for past events (skip), or ms-until-start for future.
 *
 * @param {{ time?: string, dateISO: string }} event
 * @param {Date} now
 */
export function scoreRecurringEvent(event, now) {
    const parts = event.dateISO.split('-').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return Infinity;
    const [y, mo, d] = parts;

    const startMatch = (event.time ?? '').match(/(\d{1,2})[:.](\d{2})/);
    const endMatch   = (event.time ?? '').match(/[-–](\d{1,2})[:.](\d{2})/);

    let startTime, effectiveEnd;

    if (startMatch) {
        startTime = new Date(y, mo - 1, d, parseInt(startMatch[1]), parseInt(startMatch[2]), 0, 0);
        if (endMatch) {
            const endTime = new Date(y, mo - 1, d, parseInt(endMatch[1]), parseInt(endMatch[2]), 0, 0);
            effectiveEnd = new Date(endTime.getTime() + 5 * 60 * 1000);
        } else {
            effectiveEnd = new Date(startTime.getTime() + 60 * 60 * 1000);
        }
    } else {
        // All-day event: treat today as in-progress, otherwise sort by date
        startTime = new Date(y, mo - 1, d, 0, 0, 0, 0);
        const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        if (startTime.getTime() === todayMidnight.getTime()) return -Infinity;
        effectiveEnd = new Date(startTime.getTime() + 24 * 60 * 60 * 1000);
    }

    if (startTime <= now && now < effectiveEnd) return -Infinity; // in progress
    if (effectiveEnd <= now) return Infinity;                      // past
    return startTime.getTime() - now.getTime();                    // future: ms until start
}
