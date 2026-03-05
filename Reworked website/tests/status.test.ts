import { describe, test, expect } from 'bun:test';
import { priorityOf, parseTime, resolveEvent } from '@/components/status';
import type { ScreenData } from '@/hooks/useScreenData';

// ── priorityOf ────────────────────────────────────────────────────
describe('priorityOf', () => {
    const keywords = ['openlab', 'repair', 'young maker'];

    test('returns 0 for the first matching keyword', () => {
        expect(priorityOf('Openlab donderdag', keywords)).toBe(0);
    });

    test('returns 1 for the second matching keyword', () => {
        expect(priorityOf('Repair Café', keywords)).toBe(1);
    });

    test('returns 2 for the third matching keyword', () => {
        expect(priorityOf('Young Maker avond', keywords)).toBe(2);
    });

    test('returns Infinity when nothing matches', () => {
        expect(priorityOf('Naaiworkshop', keywords)).toBe(Infinity);
    });

    test('is case-insensitive', () => {
        expect(priorityOf('REPAIR CAFÉ', keywords)).toBe(1);
    });

    test('returns Infinity for empty keywords list', () => {
        expect(priorityOf('Openlab', [])).toBe(Infinity);
    });
});

// ── parseTime ─────────────────────────────────────────────────────
describe('parseTime', () => {
    const startPattern = /(\d{1,2})[:.](\d{2})/;
    const endPattern   = /[-–](\d{1,2})[:.](\d{2})/;

    test('parses HH:MM correctly', () => {
        expect(parseTime('19:00', startPattern)).toEqual({ h: 19, m: 0 });
    });

    test('parses HH.MM correctly', () => {
        expect(parseTime('19.30', startPattern)).toEqual({ h: 19, m: 30 });
    });

    test('parses end time from range string', () => {
        expect(parseTime('19:00-21:30', endPattern)).toEqual({ h: 21, m: 30 });
    });

    test('returns null when pattern does not match', () => {
        expect(parseTime('geen tijd', startPattern)).toBeNull();
    });

    test('returns null for empty string', () => {
        expect(parseTime('', startPattern)).toBeNull();
    });
});

// ── resolveEvent ──────────────────────────────────────────────────

/** Build a minimal ScreenData fixture. */
function makeData(overrides: Partial<ScreenData> = {}): ScreenData {
    return {
        workshops: [],
        news: [],
        recurringEvents: [],
        drinks: [],
        config: {
            transitionTime: 15,
            drinksTransitionTime: 30,
            tipsTransitionTime: 10,
            paymentQrUrl: '',
            eventPriority: [],
            tips: [],
        },
        ...overrides,
    };
}

/** Format a date as YYYY-MM-DD */
function isoDate(d: Date): string {
    const y  = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const dy = String(d.getDate()).padStart(2, '0');
    return `${y}-${mo}-${dy}`;
}

describe('resolveEvent', () => {
    test('returns null when data is null', () => {
        expect(resolveEvent(null)).toBeNull();
    });

    test('returns null when there are no events', () => {
        expect(resolveEvent(makeData())).toBeNull();
    });

    test('returns a future event scheduled for today', () => {
        const now = new Date();
        // An event starting 2 hours from now
        const startHour = (now.getHours() + 2) % 24;
        const event = {
            title: 'Test Workshop',
            dateISO: isoDate(now),
            date: isoDate(now),
            time: `${String(startHour).padStart(2, '0')}:00-${String((startHour + 1) % 24).padStart(2, '0')}:00`,
        };
        const result = resolveEvent(makeData({ workshops: [event] }));
        expect(result).not.toBeNull();
        expect(result!.title).toBe('Test Workshop');
        expect(result!.isNow).toBe(false);
        expect(result!.isToday).toBe(true);
    });

    test('marks an in-progress event as isNow', () => {
        const now = new Date();
        // Started 30 min ago, ends in 30 min
        const startHour = now.getHours();
        const startMin  = Math.max(0, now.getMinutes() - 30);
        const endHour   = now.getHours() + 1;
        const pad = (n: number) => String(n).padStart(2, '0');
        const event = {
            title: 'Nu bezig evenement',
            dateISO: isoDate(now),
            date: isoDate(now),
            time: `${pad(startHour)}:${pad(startMin)}-${pad(endHour)}:${pad(now.getMinutes())}`,
        };
        const result = resolveEvent(makeData({ workshops: [event] }));
        expect(result).not.toBeNull();
        expect(result!.isNow).toBe(true);
    });

    test('skips fully past events', () => {
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const event = {
            title: 'Gisteren workshop',
            dateISO: isoDate(yesterday),
            date: isoDate(yesterday),
            time: '10:00-11:00',
        };
        expect(resolveEvent(makeData({ workshops: [event] }))).toBeNull();
    });

    test('picks the highest-priority event when multiple exist', () => {
        const now  = new Date();
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        const low  = { title: 'Gewone workshop', dateISO: isoDate(tomorrow), date: isoDate(tomorrow), time: '10:00-11:00' };
        const high = { title: 'Openlab evening',  dateISO: isoDate(tomorrow), date: isoDate(tomorrow), time: '18:00-21:00' };

        const data = makeData({
            workshops: [low, high],
            config: {
                transitionTime: 15,
                drinksTransitionTime: 30,
                tipsTransitionTime: 10,
                paymentQrUrl: '',
                eventPriority: ['openlab'],
                tips: [],
            },
        });

        const result = resolveEvent(data);
        expect(result!.title).toBe('Openlab evening');
    });

    test('prefers recurring events from recurringEvents array', () => {
        const now = new Date();
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        const recurring = { title: 'Openlab', dateISO: isoDate(tomorrow), date: isoDate(tomorrow), time: '18:00-21:00' };
        const data = makeData({ recurringEvents: [recurring] });
        const result = resolveEvent(data);
        expect(result!.title).toBe('Openlab');
    });
});
