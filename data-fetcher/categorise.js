/**
 * categorise.js — Classifies a flat list of calendar events into workshops
 * and recurring service events.
 *
 * Exported: categoriseEvents(calendar)
 *
 * Algorithm:
 *   1. Count how many times each normalised title appears.
 *   2. Events whose title appears only once → categorised on their own.
 *   3. Events whose title appears more than once → grouped.
 *   4. From each group, pick the "best" instance (currently happening >
 *      soonest upcoming > skip past).
 *   5. Categorise by the agenda's own category label when we recognise it,
 *      otherwise fall back to title keywords and price:
 *      - Has workshop keywords or a price, but NOT a recurring-service keyword → workshop.
 *      - Otherwise → recurringEvent.
 */

import {
    WORKSHOP_KEYWORDS,
    RECURRING_SERVICE_KEYWORDS,
    WORKSHOP_CATEGORIES,
    RECURRING_SERVICE_CATEGORIES,
} from './config.js';
import { scoreRecurringEvent } from './utils.js';

/**
 * Pick the single best instance from a group of events with the same title.
 * "Best" means: currently in progress, then soonest future, skipping past events.
 *
 * @param {Array<{dateISO: string, time?: string}>} instances
 * @param {Date} now
 * @returns {object|null}
 */
function pickBestInstance(instances, now) {
    let best      = null;
    let bestScore = Infinity;

    for (const event of instances) {
        const score = scoreRecurringEvent(event, now);
        if (score < bestScore) {
            best      = event;
            bestScore = score;
        }
    }

    return best;
}

/**
 * Decide whether an event is a paid workshop or a recurring community service.
 *
 * The agenda labels every event with its own category, so when that label is
 * one we recognise it settles the question outright. Only unlabelled events
 * — or labels we have not seen before — fall back to guessing from the title.
 *
 * @param {string} normalizedTitle
 * @param {object} event
 * @returns {'workshop'|'recurring'}
 */
function categoriseEvent(normalizedTitle, event) {
    const category = (event.category || '').trim().toLowerCase();
    if (category) {
        if (RECURRING_SERVICE_CATEGORIES.includes(category)) return 'recurring';
        if (WORKSHOP_CATEGORIES.includes(category)) return 'workshop';
    }

    const isService  = RECURRING_SERVICE_KEYWORDS.some(kw => normalizedTitle.includes(kw));
    const isWorkshop = WORKSHOP_KEYWORDS.some(kw => normalizedTitle.includes(kw));
    const hasPaidPrice = event.price &&
        event.price.trim().length > 0 &&
        !/gratis|free/i.test(event.price);

    // An event is a workshop if it looks like one and is NOT a known free service
    if ((isWorkshop || hasPaidPrice) && !isService) return 'workshop';
    return 'recurring';
}

/**
 * Classify a flat array of calendar events into workshops and recurring events.
 *
 * @param {Array<object>} calendar - Raw events from scrapeCalendar()
 * @returns {{ workshops: Array<object>, recurringEvents: Array<object> }}
 */
export function categoriseEvents(calendar) {
    const workshops       = [];
    const recurringEvents = [];
    const now             = new Date();

    // Step 1 — Count normalised title occurrences
    const titleCounts = {};
    for (const event of calendar) {
        const key = event.title.trim().toLowerCase();
        titleCounts[key] = (titleCounts[key] || 0) + 1;
    }

    // Step 2 — Bucket events by uniqueness
    const groupsByTitle = {};
    const uniqueEvents  = [];

    for (const event of calendar) {
        const key = event.title.trim().toLowerCase();
        if (titleCounts[key] > 1) {
            if (!groupsByTitle[key]) groupsByTitle[key] = [];
            groupsByTitle[key].push(event);
        } else {
            uniqueEvents.push(event);
        }
    }

    // Step 3 — A one-off event is a workshop unless the agenda explicitly files
    // it under a recurring community service. An unrecognised category is not
    // evidence of anything, so it must not demote a genuine one-off.
    for (const event of uniqueEvents) {
        const category = (event.category || '').trim().toLowerCase();
        if (RECURRING_SERVICE_CATEGORIES.includes(category)) {
            recurringEvents.push({ ...event, type: 'recurring' });
        } else {
            workshops.push({ ...event, type: 'workshop' });
        }
    }

    // Step 4 — Process each group of repeating events
    for (const [normalizedTitle, instances] of Object.entries(groupsByTitle)) {
        const best = pickBestInstance(instances, now);
        if (!best) continue;

        const category = categoriseEvent(normalizedTitle, best);
        if (category === 'workshop') {
            workshops.push({ ...best, type: 'workshop' });
        } else {
            recurringEvents.push({ ...best, type: 'recurring' });
        }
    }

    return { workshops, recurringEvents };
}
