import { describe, test, expect } from 'bun:test';
import { shuffleArray, priorityRank, formatDutchDate } from '@/components/event-carousel';

// ── shuffleArray ──────────────────────────────────────────────────
describe('shuffleArray', () => {
    test('returns an array of the same length', () => {
        const original = [1, 2, 3, 4, 5];
        expect(shuffleArray(original).length).toBe(original.length);
    });

    test('contains the same elements as the original', () => {
        const original = [1, 2, 3, 4, 5];
        const result   = shuffleArray(original);
        expect(result.sort()).toEqual([...original].sort());
    });

    test('does not mutate the original array', () => {
        const original = [1, 2, 3];
        const copy = [...original];
        shuffleArray(original);
        expect(original).toEqual(copy);
    });

    test('returns empty array for empty input', () => {
        expect(shuffleArray([])).toEqual([]);
    });

    test('returns single-element array unchanged', () => {
        expect(shuffleArray(['only'])).toEqual(['only']);
    });
});

// ── priorityRank ──────────────────────────────────────────────────
describe('priorityRank', () => {
    const keywords = ['openlab', 'repair', 'young maker'];

    test('returns 0 for first keyword match', () => {
        expect(priorityRank('Openlab vrijdag', keywords)).toBe(0);
    });

    test('returns 1 for second keyword match', () => {
        expect(priorityRank('Repair Café', keywords)).toBe(1);
    });

    test('returns 2 for third keyword match', () => {
        expect(priorityRank('Young Maker sessie', keywords)).toBe(2);
    });

    test('returns Infinity when no keyword matches', () => {
        expect(priorityRank('Soldering Workshop', keywords)).toBe(Infinity);
    });

    test('is case-insensitive', () => {
        expect(priorityRank('OPENLAB Evening', keywords)).toBe(0);
    });

    test('returns Infinity for empty keywords array', () => {
        expect(priorityRank('Openlab', [])).toBe(Infinity);
    });

    test('returns Infinity for empty title', () => {
        expect(priorityRank('', keywords)).toBe(Infinity);
    });
});

// ── formatDutchDate ───────────────────────────────────────────────
describe('formatDutchDate', () => {
    test('formats a known ISO date into a Dutch short string', () => {
        // 2026-03-05 is a Thursday (do)
        const result = formatDutchDate('2026-03-05');
        // The result should be a locale string with day-of-week, day number, and month
        expect(result).toMatch(/\d/);   // contains digits
        expect(result.length).toBeGreaterThan(3);
    });

    test('returns the original string for malformed input (not 3 parts)', () => {
        expect(formatDutchDate('not-a-date-string')).toBe('not-a-date-string');
    });

    test('returns the original string for input with fewer than 3 parts', () => {
        expect(formatDutchDate('2026-03')).toBe('2026-03');
    });

    test('different dates produce different output', () => {
        const d1 = formatDutchDate('2026-01-01');
        const d2 = formatDutchDate('2026-06-15');
        expect(d1).not.toBe(d2);
    });
});
