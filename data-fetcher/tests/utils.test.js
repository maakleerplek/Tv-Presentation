import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import {
    parseDutchDate,
    stripHtml,
    truncate,
    isCacheValid,
    scoreRecurringEvent,
    DUTCH_MONTHS,
} from '../utils.js';

// ── DUTCH_MONTHS ─────────────────────────────────────────────────
describe('DUTCH_MONTHS', () => {
    test('maps all 12 month abbreviations', () => {
        expect(DUTCH_MONTHS.jan).toBe(0);
        expect(DUTCH_MONTHS.feb).toBe(1);
        expect(DUTCH_MONTHS.maa).toBe(2);
        expect(DUTCH_MONTHS.mrt).toBe(2);
        expect(DUTCH_MONTHS.apr).toBe(3);
        expect(DUTCH_MONTHS.mei).toBe(4);
        expect(DUTCH_MONTHS.jun).toBe(5);
        expect(DUTCH_MONTHS.jul).toBe(6);
        expect(DUTCH_MONTHS.aug).toBe(7);
        expect(DUTCH_MONTHS.sep).toBe(8);
        expect(DUTCH_MONTHS.okt).toBe(9);
        expect(DUTCH_MONTHS.nov).toBe(10);
        expect(DUTCH_MONTHS.dec).toBe(11);
    });
});

// ── parseDutchDate ────────────────────────────────────────────────
describe('parseDutchDate', () => {
    test('parses "do 26 feb" into a valid Date', () => {
        const d = parseDutchDate('do 26 feb');
        expect(d).not.toBeNull();
        expect(d.getMonth()).toBe(1); // February
        expect(d.getDate()).toBe(26);
    });

    test('parses "za 28 mrt" correctly', () => {
        const d = parseDutchDate('za 28 mrt');
        expect(d).not.toBeNull();
        expect(d.getMonth()).toBe(2); // March
        expect(d.getDate()).toBe(28);
    });

    test('returns null for empty string', () => {
        expect(parseDutchDate('')).toBeNull();
    });

    test('returns null for unrecognised month', () => {
        expect(parseDutchDate('mo 5 xyz')).toBeNull();
    });

    test('returns null when no digits present', () => {
        expect(parseDutchDate('geen datum')).toBeNull();
    });

    test('advances year for dates more than 60 days in the past', () => {
        // Build a date string for a day guaranteed to be > 60 days in the past.
        // parseDutchDate rolls the date forward to the NEXT occurrence of that
        // month/day, meaning: if the naive "this year" date is more than 60 days
        // in the past, it bumps to year+1.
        const now = new Date();
        const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        const monthAbbrev = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'][ninetyDaysAgo.getMonth()];
        const text = `ma ${ninetyDaysAgo.getDate()} ${monthAbbrev}`;
        const d = parseDutchDate(text);
        expect(d).not.toBeNull();
        // The rolled-forward date must be in the future (> now - 60 days).
        // Since it was bumped past the 60-day threshold, the result year must be
        // strictly greater than ninetyDaysAgo.getFullYear().
        expect(d.getFullYear()).toBeGreaterThan(ninetyDaysAgo.getFullYear());
    });

    test('does NOT advance year for a recent date', () => {
        const now = new Date();
        const monthAbbrev = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'][now.getMonth()];
        const text = `wo ${now.getDate()} ${monthAbbrev}`;
        const d = parseDutchDate(text);
        expect(d).not.toBeNull();
        expect(d.getFullYear()).toBe(now.getFullYear());
    });
});

// ── stripHtml ─────────────────────────────────────────────────────
describe('stripHtml', () => {
    test('removes simple tags', () => {
        expect(stripHtml('<p>Hello</p>')).toBe('Hello');
    });

    test('removes nested tags', () => {
        expect(stripHtml('<div><span>World</span></div>')).toBe('World');
    });

    test('collapses multiple spaces', () => {
        expect(stripHtml('<p>a</p>  <p>b</p>')).toBe('a b');
    });

    test('returns the original string unchanged if no tags', () => {
        expect(stripHtml('plain text')).toBe('plain text');
    });

    test('handles empty string', () => {
        expect(stripHtml('')).toBe('');
    });
});

// ── truncate ──────────────────────────────────────────────────────
describe('truncate', () => {
    test('returns the original string when shorter than maxLen', () => {
        expect(truncate('hello', 10)).toBe('hello');
    });

    test('returns the original string when exactly maxLen', () => {
        expect(truncate('hello', 5)).toBe('hello');
    });

    test('truncates and appends ellipsis when longer than maxLen', () => {
        const result = truncate('hello world', 5);
        expect(result).toBe('hello…');
    });

    test('trims trailing whitespace before appending ellipsis', () => {
        const result = truncate('hello  world', 6);
        // 'hello ' → trimEnd → 'hello' + '…'
        expect(result).toBe('hello…');
    });

    test('returns the original value for falsy input', () => {
        expect(truncate('', 10)).toBe('');
        expect(truncate(null, 10)).toBeNull();
        expect(truncate(undefined, 10)).toBeUndefined();
    });
});

// ── isCacheValid ──────────────────────────────────────────────────
describe('isCacheValid', () => {
    test('returns false when data is null', () => {
        expect(isCacheValid({ data: null, timestamp: Date.now() }, 60000)).toBe(false);
    });

    test('returns false when cache is older than duration', () => {
        const oldTimestamp = Date.now() - 120000; // 2 minutes ago
        expect(isCacheValid({ data: [1, 2, 3], timestamp: oldTimestamp }, 60000)).toBe(false);
    });

    test('returns true when cache is fresh', () => {
        const freshTimestamp = Date.now() - 1000; // 1 second ago
        expect(isCacheValid({ data: [1, 2, 3], timestamp: freshTimestamp }, 60000)).toBe(true);
    });

    test('returns false when timestamp is 0 and data exists', () => {
        expect(isCacheValid({ data: ['x'], timestamp: 0 }, 60000)).toBe(false);
    });
});

// ── scoreRecurringEvent ───────────────────────────────────────────
describe('scoreRecurringEvent', () => {
    test('returns -Infinity for an in-progress event', () => {
        const now = new Date();
        const y = now.getFullYear();
        const mo = now.getMonth() + 1;
        const d = now.getDate();
        // Start 30 min ago, end in 30 min
        const hStart = now.getHours();
        const mStart = now.getMinutes() - 30 < 0 ? 0 : now.getMinutes() - 30;
        const hEnd   = now.getHours() + 1;
        const padded = (n) => String(n).padStart(2, '0');
        const event = {
            dateISO: `${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`,
            time: `${padded(hStart)}:${padded(mStart)}-${padded(hEnd)}:00`,
        };
        const score = scoreRecurringEvent(event, now);
        expect(score).toBe(-Infinity);
    });

    test('returns Infinity for a past event', () => {
        const event = { dateISO: '2000-01-01', time: '10:00-11:00' };
        const score = scoreRecurringEvent(event, new Date());
        expect(score).toBe(Infinity);
    });

    test('returns a positive number (ms) for a future event', () => {
        const now = new Date();
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        const y = tomorrow.getFullYear();
        const mo = String(tomorrow.getMonth() + 1).padStart(2, '0');
        const d  = String(tomorrow.getDate()).padStart(2, '0');
        const event = { dateISO: `${y}-${mo}-${d}`, time: '18:00-20:00' };
        const score = scoreRecurringEvent(event, now);
        expect(score).toBeGreaterThan(0);
    });

    test('returns -Infinity for an all-day event on today', () => {
        const now = new Date();
        const y  = now.getFullYear();
        const mo = String(now.getMonth() + 1).padStart(2, '0');
        const d  = String(now.getDate()).padStart(2, '0');
        const event = { dateISO: `${y}-${mo}-${d}`, time: '' };
        const score = scoreRecurringEvent(event, now);
        expect(score).toBe(-Infinity);
    });

    test('returns Infinity for a malformed dateISO', () => {
        const event = { dateISO: 'not-a-date', time: '' };
        expect(scoreRecurringEvent(event, new Date())).toBe(Infinity);
    });
});
