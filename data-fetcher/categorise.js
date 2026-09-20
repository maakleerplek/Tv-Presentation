/**
 * categorise.js — Classifies a flat list of calendar events into workshops
 * and recurring service events.
 *
 * Exported: categoriseEvents(calendar)
 *
 * Algorithm:
 *   1. Group every occurrence by its agenda slug, falling back to the
 *      normalised title for entries that have none.
 *   2. From each group, pick the "best" instance (currently happening >
 *      soonest upcoming > skip past), so one event is one slide.
 *   3. Categorise by the agenda's own category label when we recognise it,
 *      otherwise fall back to title keywords and price, and failing that to
 *      whether the event repeats.
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
 * one we recognise it settles the question outright. Everything else falls
 * back to the title keywords and the price, and only when none of those say
 * anything does the shape of the event decide: something that repeats is a
 * service, a one-off is a workshop.
 *
 * That last step matters for an unfamiliar label. "maakleerfest — Autovrije
 * Zondag" is filed under "Evenement", which we do not recognise; an unknown
 * label is not evidence of anything and must not demote a genuine one-off.
 *
 * @param {object} event
 * @param {boolean} isRepeating  whether the event has more than one date
 * @returns {'workshop'|'recurring'}
 */
function categoriseEvent(event, isRepeating) {
    const category = (event.category || '').trim().toLowerCase();
    if (RECURRING_SERVICE_CATEGORIES.includes(category)) return 'recurring';
    if (WORKSHOP_CATEGORIES.includes(category)) return 'workshop';

    const normalizedTitle = event.title.trim().toLowerCase();
    const isService  = RECURRING_SERVICE_KEYWORDS.some(kw => normalizedTitle.includes(kw));
    const isWorkshop = WORKSHOP_KEYWORDS.some(kw => normalizedTitle.includes(kw));
    const hasPaidPrice = event.price &&
        event.price.trim().length > 0 &&
        !/gratis|free/i.test(event.price);

    if (isService) return 'recurring';
    if (isWorkshop || hasPaidPrice) return 'workshop';

    return isRepeating ? 'recurring' : 'workshop';
}

/**
 * The key that decides whether two entries are the same event.
 *
 * The agenda slug is the site's own identity for an event and is the only
 * reliable one. Titles are not: a four-part course numbers its sessions
 * ("CNC-frees leren gebruiken (1/4)" … "(4/4)"), which reads as four distinct
 * titles and used to fill the carousel with four near-identical slides.
 * Custom news and older cached events carry no slug, so those fall back to
 * the normalised title.
 */
function groupKey(event) {
    return event.slug || event.title.trim().toLowerCase();
}

export function categoriseEvents(calendar) {
    const workshops       = [];
    const recurringEvents = [];
    const now             = new Date();

    // Step 1 — Bucket every occurrence under the event it belongs to
    const groups = new Map();
    for (const event of calendar) {
        const key = groupKey(event);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(event);
    }

    // Step 2 — Each event contributes exactly one slide: the instance that is
    // running now, else the soonest one still to come.
    for (const instances of groups.values()) {
        const isRepeating = instances.length > 1;
        const best = isRepeating ? pickBestInstance(instances, now) : instances[0];
        if (!best) continue;

        if (categoriseEvent(best, isRepeating) === 'workshop') {
            workshops.push({ ...best, type: 'workshop' });
        } else {
            recurringEvents.push({ ...best, type: 'recurring' });
        }
    }

    return { workshops, recurringEvents };
}
