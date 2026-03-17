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
        const now = new Date(2026, 2, 16, 12, 0); // Monday March 16, 2026, 12:00
        const event = {
            title: 'Test Workshop',
            dateISO: '2026-03-16',
            date: 'ma 16 maa',
            time: '19:00-21:00',
        };
        const result = resolveEvent(makeData({ workshops: [event] }), now);
        expect(result).not.toBeNull();
        expect(result!.title).toBe('Test Workshop');
        expect(result!.isNow).toBe(false);
        expect(result!.isToday).toBe(true);
    });

    test('marks an in-progress event as isNow', () => {
        const now = new Date(2026, 2, 16, 19, 30); // 19:30
        const event = {
            title: 'Nu bezig evenement',
            dateISO: '2026-03-16',
            date: 'ma 16 maa',
            time: '19:00-21:00',
        };
        const result = resolveEvent(makeData({ workshops: [event] }), now);
        expect(result).not.toBeNull();
        expect(result!.isNow).toBe(true);
    });

    test('skips fully past events', () => {
        const now = new Date(2026, 2, 16, 12, 0);
        const event = {
            title: 'Gisteren workshop',
            dateISO: '2026-03-15',
            date: 'zo 15 maa',
            time: '10:00-11:00',
        };
        expect(resolveEvent(makeData({ workshops: [event] }), now)).toBeNull();
    });

    test('picks higher priority event on the same day even if it starts later', () => {
        const now = new Date(2026, 2, 16, 12, 0);
        // Event A: today at 19:00, low priority
        const low = { title: 'Gewone workshop', dateISO: '2026-03-16', date: 'ma 16 maa', time: '19:00-21:00' };
        // Event B: today at 20:00, high priority
        const high = { title: 'Openlab', dateISO: '2026-03-16', date: 'ma 16 maa', time: '20:00-22:00' };

        const data = makeData({
            workshops: [low, high],
            config: {
                transitionTime: 15,
                tipsTransitionTime: 10,
                paymentQrUrl: '',
                eventPriority: ['openlab'],
                tips: [],
            },
        });

        const result = resolveEvent(data, now);
        expect(result!.title).toBe('Openlab');
    });

    test('prefers high priority tomorrow over low priority today', () => {
        const now = new Date(2026, 2, 16, 12, 0);
        
        // Event A: today at 19:00, low priority
        const lowToday = { title: 'Gewone workshop', dateISO: '2026-03-16', date: 'ma 16 maa', time: '19:00-21:00' };
        // Event B: tomorrow at 10:00, high priority
        const highTomorrow = { title: 'Openlab', dateISO: '2026-03-17', date: 'di 17 maa', time: '10:00-12:00' };

        const data = makeData({
            workshops: [lowToday, highTomorrow],
            config: {
                transitionTime: 15,
                tipsTransitionTime: 10,
                paymentQrUrl: '',
                eventPriority: ['openlab'],
                tips: [],
            },
        });

        const result = resolveEvent(data, now);
        // Priority wins even if it's tomorrow
        expect(result!.title).toBe('Openlab');
    });

    test('does not skip all-day events (no time) during the day', () => {
        const now = new Date(2026, 2, 16, 10, 0); // 10:00 AM
        const allDayEvent = { 
            title: 'All-day Workshop', 
            dateISO: '2026-03-16', 
            date: 'ma 16 maa', 
            time: '' // No time
        };

        const data = makeData({ workshops: [allDayEvent] });
        const result = resolveEvent(data, now);
        expect(result).not.toBeNull();
        expect(result!.title).toBe('All-day Workshop');
        expect(result!.isNow).toBe(true); // Should be "Now" because it's all day today
    });

    test('prefers high priority upcoming today over low priority now', () => {
        const now = new Date(2026, 2, 16, 19, 30); // 19:30
        
        // Event A: Today 19:00-21:00, low priority (is Now)
        const lowNow = { title: 'Gewone workshop', dateISO: '2026-03-16', date: 'ma 16 maa', time: '19:00-21:00' };
        // Event B: Today 20:00-22:00, high priority (is Upcoming)
        const highLater = { title: 'Openlab', dateISO: '2026-03-16', date: 'ma 16 maa', time: '20:00-22:00' };

        const data = makeData({
            workshops: [lowNow, highLater],
            config: {
                eventPriority: ['openlab'],
            },
        });

        const result = resolveEvent(data, now);
        expect(result!.title).toBe('Openlab');
        expect(result!.isNow).toBe(false); // It's still upcoming
    });
});
