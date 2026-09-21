import { describe, it, expect } from 'bun:test';
import { parseDbTimestamp, formatRelativeTime } from '../components/drinks-list';

/**
 * Regression: on a Brussels screen every changelog entry appeared two hours old
 * the instant it was written, because SQLite stores UTC without a zone marker
 * and JavaScript parses that form as local time.
 */
describe('parseDbTimestamp', () => {
    it('reads a bare SQLite timestamp as UTC, not local', () => {
        expect(parseDbTimestamp('2026-09-21 14:18:11'))
            .toBe(Date.parse('2026-09-21T14:18:11Z'));
    });

    it('leaves a timestamp that already states its zone alone', () => {
        expect(parseDbTimestamp('2026-09-21T14:18:11Z'))
            .toBe(Date.parse('2026-09-21T14:18:11Z'));
        expect(parseDbTimestamp('2026-09-21T16:18:11+02:00'))
            .toBe(Date.parse('2026-09-21T14:18:11Z'));
    });
});

describe('formatRelativeTime', () => {
    const at = (msAgo: number) =>
        new Date(Date.now() - msAgo).toISOString().replace('T', ' ').slice(0, 19);

    it('calls a purchase made seconds ago "just now"', () => {
        expect(formatRelativeTime(at(5_000))).toBe('just now');
    });

    it('does not report a fresh entry as hours old', () => {
        expect(formatRelativeTime(at(2_000))).not.toContain('hr');
    });

    it('still counts real elapsed time', () => {
        expect(formatRelativeTime(at(3 * 60 * 60_000))).toBe('3 hr ago');
        expect(formatRelativeTime(at(5 * 60_000))).toBe('5 min ago');
    });
});
