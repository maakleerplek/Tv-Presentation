import { describe, it, expect } from 'bun:test';
import { untracked } from '../changelog-reporter.js';

const sale = (id, item_name, quantity, created_at, over = {}) =>
    ({ id, action: 'checkout', source: 'checkout', item_name, quantity, created_at, ...over });

describe('untracked', () => {
    it('matches a sale logged long before the stock check (TV was off)', () => {
        const since = Date.parse('2026-10-12T11:20:00Z');        // previous check
        const log = [sale(78, 'Monster', 1, '2026-10-12 11:30:20')];
        expect(untracked(log, 'Monster', -1, since)).toBe(0);
    });

    it('matches each logged event only once, and only the part it covers', () => {
        const since = Date.parse('2026-10-12T11:20:00Z');
        const log = [sale(1, 'Cola', 1, '2026-10-12 11:30:00')];
        expect(untracked(log, 'Cola', -3, since)).toBe(2);          // 1 of 3 was logged
        expect(untracked(log, 'Cola', -1, since)).toBe(1);          // event 1 already used
    });

    it('ignores its own events, other directions and events before the previous check', () => {
        const since = Date.parse('2026-10-12T12:00:00Z');
        const log = [
            sale(10, 'Ice Tea', 1, '2026-10-12 12:05:00', { source: 'inventree-sync' }),
            sale(11, 'Ice Tea', 1, '2026-10-12 12:05:00', { action: 'add' }),
            sale(12, 'Ice Tea', 1, '2026-10-12 11:00:00'),
        ];
        expect(untracked(log, 'Ice Tea', -1, since)).toBe(1);
    });
});
