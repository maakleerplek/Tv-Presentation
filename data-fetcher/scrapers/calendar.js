/**
 * scrapers/calendar.js — Scrapes the maakleerplek.be event calendar.
 *
 * Exported: scrapeCalendar()
 */

import * as cheerio from 'cheerio';
import {
    CALENDAR_URL,
    CACHE_DURATION_MS,
    EVENT_PRIORITY,
    WORKSHOP_KEYWORDS,
    MAX_EVENT_DETAILS,
} from '../config.js';
import { parseDutchDate, isCacheValid } from '../utils.js';
import { fetchEventDetail } from '../event-detail.js';

// ── In-memory cache ───────────────────────────────────────────────────────────

let calendarCache = { data: null, timestamp: 0 };

// ── Helpers ───────────────────────────────────────────────────────────────────

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

/**
 * Parse a single `.agenda_item` element and return a raw event object,
 * or null if the item has no usable title.
 *
 * The `.agenda_item_time` field dual-purposes as either a time string
 * ("18:00 - 20:00") or a location label ("Grafisch Lab"); we detect
 * which by checking for digits.
 */
function parseAgendaItem($, itemEl, date, dateText) {
    const titleRaw  = $(itemEl).find('.agenda_item_title').text().trim();
    const timeRaw   = $(itemEl).find('.agenda_item_time').text().trim();
    const link      = $(itemEl).find('a').attr('href') || '';

    if (!titleRaw) {
        console.warn(`[Calendar] Missing title for an event on ${dateText}`);
        return null;
    }

    // Determine whether timeRaw is a time or a location
    let timeStr    = '';
    let locationStr = '';
    if (/(\d{1,2}[:.]?\d{2})/.test(timeRaw)) {
        timeStr = timeRaw;
    } else {
        locationStr = timeRaw;
    }

    // If still no time, check whether the title embeds one (e.g. "Workshop 19:00" or "19:00 - 21:00 naam")
    let title = titleRaw;
    if (!timeStr) {
        const titleTimeMatch = titleRaw.match(/\b(\d{1,2}[:.]?\d{2}\s*[-–]\s*\d{1,2}[:.]?\d{2}|\d{1,2}[:.]?\d{2})\b/);
        if (titleTimeMatch) {
            timeStr = titleTimeMatch[0].replace(/\./g, ':').trim();
            title   = titleRaw
                .replace(titleTimeMatch[0], '')
                .replace(/^\s*[-–|:]\s*|\s*[-–|:]\s*$/g, '')
                .trim();
        }
    }

    if (!timeStr) console.warn(`[Calendar] No time found for "${titleRaw}" on ${dateText}`);

    // Build a timezone-safe ISO date string from local date parts
    const mm      = String(date.getMonth() + 1).padStart(2, '0');
    const dd      = String(date.getDate()).padStart(2, '0');
    const dateISO = `${date.getFullYear()}-${mm}-${dd}`;

    return { title, location: locationStr, time: timeStr, date: dateText, dateISO, link };
}

/**
 * Decide whether we should fetch the detail page for a given event.
 * We always fetch priority / workshop events; for others we cap at MAX_EVENT_DETAILS.
 */
function shouldFetchDetail(event, index) {
    const titleLower       = event.title.toLowerCase();
    const isPriorityEvent  = EVENT_PRIORITY.some(kw => titleLower.includes(kw));
    const isWorkshopEvent  = WORKSHOP_KEYWORDS.some(kw => titleLower.includes(kw));
    return event.link && (isPriorityEvent || isWorkshopEvent || index < MAX_EVENT_DETAILS);
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Scrape the maakleerplek.be calendar and return an array of upcoming events,
 * each optionally enriched with detail-page data (description, image, time, …).
 * Results are cached for CACHE_DURATION_MS.
 */
export async function scrapeCalendar() {
    if (isCacheValid(calendarCache, CACHE_DURATION_MS)) return calendarCache.data;

    console.log('[Calendar] Scraping', CALENDAR_URL);

    const response = await fetch(CALENDAR_URL, { headers: { 'User-Agent': USER_AGENT } });
    const html     = await response.text();
    const $        = cheerio.load(html);

    const events    = [];
    const seenKeys  = new Set();
    const today     = new Date();
    today.setHours(0, 0, 0, 0);

    // Each .agenda_element represents one calendar day
    $('.agenda_element').each((_, dayEl) => {
        const dateText = $(dayEl).find('.agenda_date h4').text().trim();
        const date     = parseDutchDate(dateText);
        if (!date || date < today) return; // skip past dates

        $(dayEl).find('.agenda_item').each((_, itemEl) => {
            const event = parseAgendaItem($, itemEl, date, dateText);
            if (!event || !event.title) return;

            // Deduplicate: same link + same day + same normalised title
            const key = `${event.link}|${event.dateISO}|${event.title}`;
            if (seenKeys.has(key)) return;
            seenKeys.add(key);

            events.push(event);
        });
    });

    // Enrich events with data from their individual detail pages
    const enriched = await Promise.all(
        events.map(async (event, i) => {
            if (!shouldFetchDetail(event, i)) return event;
            const detail = await fetchEventDetail(event.link);
            return {
                ...event,
                ...detail,
                time:     detail.time     || event.time,
                location: detail.location || event.location || 'maakleerplek',
            };
        })
    );

    calendarCache = { data: enriched, timestamp: Date.now() };

    console.log(`[Calendar] Scraped ${enriched.length} upcoming events:`);
    enriched.forEach((e, i) =>
        console.log(`  ${i + 1}. [${e.dateISO} ${e.time || '??:??'}] ${e.title} (@ ${e.location || 'maakleerplek'})`)
    );

    return enriched;
}
