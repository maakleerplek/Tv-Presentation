import { describe, test, expect } from 'bun:test';
import { categoriseEvents } from '../categorise.js';

/** Build an event the way scrapeCalendar() emits one. */
function ev(overrides) {
    const base = new Date();
    base.setDate(base.getDate() + 30); // safely in the future
    const dateISO = base.toISOString().slice(0, 10);
    return {
        slug: 'some-event', dateISO, date: '', time: '19:00 - 21:00',
        title: 'Some event', category: 'Workshop', registration: 'Inschrijven',
        location: 'High Tech Lab', link: '', description: '', imageUrl: '', price: '',
        ...overrides,
    };
}

/** Days from now, as an ISO date. */
function inDays(n) {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
}

describe('categoriseEvents — one event, one slide', () => {
    test('collapses a numbered course into a single slide', () => {
        // The four sessions share a slug but number their titles, which used to
        // produce four near-identical carousel slides.
        const calendar = [1, 2, 3, 4].map(n => ev({
            slug: 'cnc-frees-leren-gebruiken',
            title: `CNC-frees leren gebruiken (${n}/4)`,
            dateISO: inDays(10 + n * 7),
        }));

        const { workshops, recurringEvents } = categoriseEvents(calendar);
        expect(workshops.length + recurringEvents.length).toBe(1);
        expect(workshops[0].title).toBe('CNC-frees leren gebruiken (1/4)'); // the soonest
    });

    test('collapses the weekly occurrences of one recurring event', () => {
        const calendar = [0, 7, 14, 21].map(n => ev({
            slug: 'open-high-tech-lab-donderdag',
            title: 'Open (High Tech) Lab op donderdag',
            category: 'Open Lab',
            dateISO: inDays(3 + n),
        }));

        const { workshops, recurringEvents } = categoriseEvents(calendar);
        expect(recurringEvents.length).toBe(1);
        expect(workshops.length).toBe(0);
    });

    test('keeps genuinely different events apart even when titles look alike', () => {
        const calendar = [
            ev({ slug: 'naailes-voor-beginners-dag',   title: 'Naailes voor beginners: dag' }),
            ev({ slug: 'naailes-voor-beginners-avond', title: 'Naailes voor beginners: avond' }),
        ];
        expect(categoriseEvents(calendar).workshops.length).toBe(2);
    });

    test('falls back to the title when an entry has no slug', () => {
        const calendar = [
            ev({ slug: undefined, title: 'Zonder slug', dateISO: inDays(5) }),
            ev({ slug: undefined, title: 'Zonder slug', dateISO: inDays(12) }),
            ev({ slug: undefined, title: 'Andere zonder slug' }),
        ];
        const { workshops, recurringEvents } = categoriseEvents(calendar);
        expect(workshops.length + recurringEvents.length).toBe(2);
    });
});

describe('categoriseEvents — classification', () => {
    test('the agenda category decides over the title keywords', () => {
        // "Open (High Tech) Lab op donderdag" does not contain the substring
        // "open lab", so the keyword list alone would call it a workshop.
        const calendar = [ev({ slug: 'a', title: 'Open (High Tech) Lab op donderdag', category: 'Open Lab' })];
        expect(categoriseEvents(calendar).recurringEvents.length).toBe(1);
    });

    test('an unrecognised category leaves a one-off as a workshop', () => {
        const calendar = [ev({ slug: 'b', title: 'maakleerfest — Autovrije Zondag', category: 'Evenement' })];
        expect(categoriseEvents(calendar).workshops.length).toBe(1);
    });

    test('falls back to keywords when there is no category at all', () => {
        const calendar = [
            ev({ slug: 'c', title: 'Workshop houtbewerking', category: '' }),
            ev({ slug: 'd', title: 'Open lab dinsdag',       category: '' }),
        ];
        const { workshops, recurringEvents } = categoriseEvents(calendar);
        expect(workshops.map(w => w.slug)).toEqual(['c']);
        expect(recurringEvents.map(r => r.slug)).toEqual(['d']);
    });
});
