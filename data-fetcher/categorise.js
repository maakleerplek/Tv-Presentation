/**
 * categorise.js — Classifies a flat list of calendar events into workshops
 * and recurring service events.
 *
 * Exported: categoriseEvents(calendar)
 *
 * Algorithm:
 *   1. Count how many times each normalised title appears.
 *   2. Events whose title appears only once → workshop.
 *   3. Events whose title appears more than once → grouped.
 *   4. From each group, pick the "best" instance (currently happening >
 *      soonest upcoming > skip past).
 *   5. Categorise each group:
 *      - Has workshop keywords or a price, but NOT a recurring-service keyword → workshop.
 *      - Otherwise → recurringEvent.
 */

import {
    WORKSHOP_KEYWORDS,
    RECURRING_SERVICE_KEYWORDS,
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
 * Decide the category for a group of recurring events.
 *
 * @param {string} normalizedTitle
 * @param {object} bestInstance
 * @returns {'workshop'|'recurring'}
 */
function categoriseGroup(normalizedTitle, bestInstance) {
    const isService  = RECURRING_SERVICE_KEYWORDS.some(kw => normalizedTitle.includes(kw));
    const isWorkshop = WORKSHOP_KEYWORDS.some(kw => normalizedTitle.includes(kw));
    const hasPaidPrice = bestInstance.price &&
        bestInstance.price.trim().length > 0 &&
        !/gratis|free/i.test(bestInstance.price);

    // A group is a workshop if it looks like one and is NOT a known free service
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

    // Step 3 — Unique events are always workshops
    uniqueEvents.forEach(e => workshops.push({ ...e, type: 'workshop' }));

    // Step 4 — Process each group of repeating events
    for (const [normalizedTitle, instances] of Object.entries(groupsByTitle)) {
        const best = pickBestInstance(instances, now);
        if (!best) continue;

        const category = categoriseGroup(normalizedTitle, best);
        if (category === 'workshop') {
            workshops.push({ ...best, type: 'workshop' });
        } else {
            recurringEvents.push({ ...best, type: 'recurring' });
        }
    }

    return { workshops, recurringEvents };
}
