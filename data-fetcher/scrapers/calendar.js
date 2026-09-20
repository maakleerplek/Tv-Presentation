/**
 * scrapers/calendar.js — Fetches upcoming events from the maakleerplek agenda.
 *
 * History: the site ran on WordPress and exposed a `kalender` custom post type
 * over the WP REST API. In September 2026 it was rebuilt on Next.js and the
 * whole `/wp-json` surface disappeared, so we read the public agenda instead.
 *
 * The agenda renders one month per request. Every occurrence is a link with a
 * machine-readable `title` attribute:
 *
 *   href  = /nl/agenda/<slug>?date=YYYY-MM-DD
 *   title = "13:00–17:00 · YOUNG MAKER LAB (woensdag) · Jongeren · High Tech Lab · Gewoon binnenlopen"
 *           └─ time ──┘   └─ name ─────────────────┘   └─ cat ─┘  └─ lab (opt) ┘  └─ registration ─┘
 *
 * That gives us the site's own expansion of recurring events, including its
 * holiday cancellations — logic we would otherwise have to duplicate. The
 * per-event description, image and price are not in the overview, so they are
 * pulled from each event page's schema.org JSON-LD and cached per slug.
 */

import * as cheerio from 'cheerio';
import {
    CALENDAR_URL,
    CALENDAR_MONTHS_AHEAD,
    CACHE_DURATION_MS,
    MAX_EVENT_DETAILS,
    resolveMaakleerplekUrl,
} from '../config.js';
import { isCacheValid } from '../utils.js';
import { fetchEventDetail } from '../event-detail.js';

// ── In-memory cache ───────────────────────────────────────────────────────────

let calendarCache = { data: null, timestamp: 0 };
let inflightFetch = null; // shared promise — prevents duplicate concurrent fetches

/**
 * Per-slug cache of event-page details. Descriptions, images and prices belong
 * to the event itself rather than to a single occurrence, so one fetch serves
 * every date a recurring event runs on — and survives the next refresh.
 */
const detailCache = new Map(); // slug → { data, timestamp }
const DETAIL_CACHE_DURATION_MS = 6 * 60 * 60 * 1000; // 6 hours

// ── Constants ─────────────────────────────────────────────────────────────────

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

const DUTCH_DAYS   = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
const DUTCH_MONTHS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

/** Registration label the agenda puts on an occurrence that will not happen. */
const CANCELLED_LABEL = 'geannuleerd';

/** Fetch this many event pages concurrently. */
const DETAIL_BATCH = 4;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** "2026-05-07" → "do 7 mei" */
export function isoToDutch(dateISO) {
    const [y, m, d] = dateISO.split('-').map(Number);
    if (!y || !m || !d) return '';
    const dow = new Date(y, m - 1, d).getDay();
    return `${DUTCH_DAYS[dow]} ${d} ${DUTCH_MONTHS[m - 1]}`;
}

/** Today as "YYYY-MM-DD" in local time (not UTC — the agenda is a local calendar). */
function todayISO() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** The current month plus the next `count` months, as "YYYY-MM" strings. */
export function monthsToFetch(count, from = new Date()) {
    const months = [];
    for (let i = 0; i <= count; i++) {
        const d = new Date(from.getFullYear(), from.getMonth() + i, 1);
        months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return months;
}

/**
 * Split an agenda `title` attribute into its parts.
 * Four- and five-part forms both occur; the lab segment is the optional one.
 *
 * @returns {{time:string, name:string, category:string, lab:string, registration:string}|null}
 */
export function parseTitleAttr(titleAttr) {
    const parts = titleAttr.split('·').map(s => s.trim()).filter(Boolean);
    if (parts.length < 4) return null;

    const [time, name, category] = parts;
    const registration = parts[parts.length - 1];
    const lab = parts.length >= 5 ? parts[3] : '';

    if (!/^\d{1,2}:\d{2}/.test(time) || !name) return null;

    return {
        // "13:00–17:00" → "13:00 - 17:00", matching the format utils.js parses
        time: time.replace(/\s*[-–—]\s*/, ' - '),
        name,
        category,
        lab,
        registration,
    };
}

/**
 * Extract every event occurrence from one rendered agenda month.
 *
 * @param {string} html
 * @returns {Array<object>} occurrences, possibly containing duplicates
 */
export function parseAgendaMonth(html) {
    const $ = cheerio.load(html);
    const occurrences = [];

    $('a[href*="/agenda/"][title]').each((_, el) => {
        const href = $(el).attr('href') || '';
        const match = href.match(/\/agenda\/([^/?#]+)\?(?:[^#]*&)?date=(\d{4}-\d{2}-\d{2})/);
        if (!match) return;

        const parsed = parseTitleAttr($(el).attr('title') || '');
        if (!parsed) return;

        const [, slug, dateISO] = match;

        occurrences.push({
            slug,
            dateISO,
            date:         isoToDutch(dateISO),
            title:        parsed.name,
            time:         parsed.time,
            category:     parsed.category,
            registration: parsed.registration,
            location:     parsed.lab || 'maakleerplek',
            link:         resolveMaakleerplekUrl(href.replace(/^\//, '')),
            description:  '',
            imageUrl:     '',
            price:        '',
        });
    });

    return occurrences;
}

/** Fetch one agenda month. Retries once, then gives up and reports failure. */
async function fetchMonth(month) {
    const url = `${CALENDAR_URL}?view=month&month=${month}`;
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
            if (res.ok) return { month, occurrences: parseAgendaMonth(await res.text()), ok: true };
            if (res.status < 500) break; // 4xx won't improve with a retry
        } catch (err) {
            console.warn(`[Calendar] Month ${month} fetch failed:`, err.message);
        }
        if (attempt === 0) await new Promise(r => setTimeout(r, 1000));
    }
    return { month, occurrences: [], ok: false };
}

/**
 * Look up description, image and price for an event, reusing the per-slug
 * cache so a weekly event costs one request instead of one per occurrence.
 */
async function getDetail(occurrence) {
    const cached = detailCache.get(occurrence.slug);
    if (cached && Date.now() - cached.timestamp < DETAIL_CACHE_DURATION_MS) return cached.data;

    const data = await fetchEventDetail(occurrence.link);
    detailCache.set(occurrence.slug, { data, timestamp: Date.now() });
    return data;
}

/**
 * Enrich events with their detail-page metadata, in small concurrent batches
 * so we never hammer the site.
 *
 * The budget is spent per distinct event, not per occurrence: a weekly open lab
 * fills 15 slots in the list but needs one fetch, and the result is copied onto
 * every one of its dates. That makes MAX_EVENT_DETAILS cover months of agenda
 * instead of the next fortnight.
 */
async function enrichEvents(events) {
    const bySlug = new Map();
    for (const event of events) {
        if (!bySlug.has(event.slug)) bySlug.set(event.slug, []);
        bySlug.get(event.slug).push(event);
    }

    // Insertion order follows the sorted event list, so the soonest events are
    // enriched first and the cap only ever drops the most distant ones.
    const allSlugs = [...bySlug.keys()];
    const slugs = allSlugs.slice(0, MAX_EVENT_DETAILS);

    // Truncation is silent on screen — those events just render without a
    // description or image — so say it out loud in the log.
    if (allSlugs.length > slugs.length) {
        console.warn(
            `[Calendar] MAX_EVENT_DETAILS=${MAX_EVENT_DETAILS} leaves ` +
            `${allSlugs.length - slugs.length} of ${allSlugs.length} events without a description or image`
        );
    }

    for (let i = 0; i < slugs.length; i += DETAIL_BATCH) {
        const batch = slugs.slice(i, i + DETAIL_BATCH);
        const details = await Promise.all(batch.map(slug => getDetail(bySlug.get(slug)[0])));

        batch.forEach((slug, j) => {
            const detail = details[j] || {};
            for (const event of bySlug.get(slug)) {
                if (detail.description) event.description = detail.description;
                if (detail.imageUrl)    event.imageUrl    = detail.imageUrl;
                if (detail.price)       event.price       = detail.price;
                // The agenda's own time wins: JSON-LD reports the series end date
                // for recurring events, which would render as a nonsense range.
                if (!event.time && detail.time) event.time = detail.time;
            }
        });

        if (i + DETAIL_BATCH < slugs.length) await new Promise(r => setTimeout(r, 300));
    }

    return events;
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function scrapeCalendar() {
    if (isCacheValid(calendarCache, CACHE_DURATION_MS)) return calendarCache.data;

    // Stale-while-revalidate: if we have any data, return it immediately and
    // kick off a background refresh so callers never wait for the long fetch.
    if (calendarCache.data && !inflightFetch) {
        inflightFetch = doFetch().finally(() => { inflightFetch = null; });
        return calendarCache.data;
    }

    // If a fetch is already in progress, wait for it rather than starting another.
    if (inflightFetch) return inflightFetch;

    // No data at all (first startup) — must wait for the initial fetch.
    inflightFetch = doFetch().finally(() => { inflightFetch = null; });
    return inflightFetch;
}

async function doFetch() {
    const months = monthsToFetch(CALENDAR_MONTHS_AHEAD);
    console.log(`[Calendar] Fetching agenda ${CALENDAR_URL} for ${months.join(', ')}`);

    const results = await Promise.all(months.map(fetchMonth));

    // A month that failed outright is different from a month with no events:
    // only bail out when we could not read a single page.
    if (!results.some(r => r.ok)) {
        console.error('[Calendar] All agenda months failed to fetch, skipping cache update');
        return calendarCache.data ?? [];
    }

    results.filter(r => !r.ok).forEach(r => console.warn(`[Calendar] Month ${r.month} unavailable`));

    // Deduplicate: the agenda renders the same occurrence twice for its
    // responsive layouts, and month views overlap at the edges.
    const today = todayISO();
    const seen = new Map();

    for (const occurrence of results.flatMap(r => r.occurrences)) {
        if (occurrence.dateISO < today) continue;
        if (occurrence.registration.toLowerCase() === CANCELLED_LABEL) continue;
        const key = `${occurrence.slug}|${occurrence.dateISO}|${occurrence.time}`;
        if (!seen.has(key)) seen.set(key, occurrence);
    }

    const events = [...seen.values()].sort(
        (a, b) => a.dateISO.localeCompare(b.dateISO) || a.time.localeCompare(b.time)
    );

    await enrichEvents(events);

    // Only cache if we got real data — don't lock in an empty result on transient failures
    if (events.length > 0) calendarCache = { data: events, timestamp: Date.now() };

    console.log(`[Calendar] Fetched ${events.length} upcoming events from ${months.length} months:`);
    events.slice(0, 15).forEach((e, i) =>
        console.log(`  ${i + 1}. [${e.dateISO} ${e.time || '??:??'}] ${e.title} (${e.category})`)
    );

    return events;
}
