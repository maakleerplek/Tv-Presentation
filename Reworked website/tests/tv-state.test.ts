import { describe, test, expect } from 'bun:test';
import {
    initialState, view, navigate, reportKiosk,
    CYCLE_MS, MANUAL_HOLD_MS, KIOSK_STALE_MS,
} from '@/lib/tv-state';

const T0 = 1_000_000;

describe('cycling', () => {
    test('advances one page per cycle', () => {
        const s = initialState(T0);
        expect(view(s, T0).page).toBe(0);
        expect(view(s, T0 + CYCLE_MS - 1).page).toBe(0);
        expect(view(s, T0 + CYCLE_MS).page).toBe(1);
        expect(view(s, T0 + 3.5 * CYCLE_MS)).toEqual({ page: 3, cycling: true, msIntoPage: CYCLE_MS / 2 });
    });

    test('an idle heartbeat does not disturb the cycle', () => {
        let s = initialState(T0);
        s = reportKiosk(s, false, T0 + 2.5 * CYCLE_MS);
        expect(view(s, T0 + 3 * CYCLE_MS).page).toBe(3);
    });
});

describe('kiosk busy', () => {
    test('freezes on the page on screen and resumes there with a full cycle', () => {
        let s = initialState(T0);
        s = reportKiosk(s, true, T0 + 2.5 * CYCLE_MS);
        expect(view(s, T0 + 2.5 * CYCLE_MS)).toEqual({ page: 2, cycling: false, msIntoPage: 0 });
        expect(view(s, T0 + 8 * CYCLE_MS).page).toBe(2);

        const resume = T0 + 9 * CYCLE_MS;
        s = reportKiosk(s, true, resume - 1000);   // heartbeat keeps it alive
        s = reportKiosk(s, false, resume);
        expect(view(s, resume + CYCLE_MS - 1).page).toBe(2);
        expect(view(s, resume + CYCLE_MS).page).toBe(3);
    });

    test('a silent busy kiosk counts as idle after the stale timeout, without skipping pages', () => {
        let s = initialState(T0);
        s = reportKiosk(s, true, T0);
        expect(view(s, T0 + KIOSK_STALE_MS - 1).cycling).toBe(false);
        expect(view(s, T0 + KIOSK_STALE_MS)).toEqual({ page: 0, cycling: true, msIntoPage: 0 });
        expect(view(s, T0 + KIOSK_STALE_MS + CYCLE_MS).page).toBe(1);
    });
});

describe('navigation', () => {
    test('moves from the page on screen and holds it', () => {
        let s = initialState(T0);
        const t = T0 + 2.5 * CYCLE_MS;
        s = navigate(s, 1, t);
        expect(view(s, t)).toEqual({ page: 3, cycling: false, msIntoPage: 0 });
        s = navigate(s, -1, t + 1000);
        s = navigate(s, -1, t + 2000);
        expect(view(s, t + 2000).page).toBe(1);
        expect(view(s, t + 2000 + MANUAL_HOLD_MS - 1).cycling).toBe(false);
    });

    test('cycling resumes after the hold without skipping pages', () => {
        let s = initialState(T0);
        s = navigate(s, 1, T0);
        const end = T0 + MANUAL_HOLD_MS;
        expect(view(s, end)).toEqual({ page: 1, cycling: true, msIntoPage: 0 });
        expect(view(s, end + CYCLE_MS).page).toBe(2);
    });

    test('works while the kiosk is busy, and can go below zero (the TV wraps it)', () => {
        let s = reportKiosk(initialState(T0), true, T0);
        s = navigate(s, -1, T0 + 1000);
        expect(view(s, T0 + 1000).page).toBe(-1);
    });
});

import { buildPages, wrapPage, groupDrinks, ROW_PX, HEADER_PX, GAP_PX } from '@/components/drinks-list';

import { mergeCategoryOrder, sanitizeCategoryOrder } from '@/lib/category-order';

describe('category order settings', () => {
    test('merge keeps the saved order and appends new categories alphabetically', () => {
        expect(mergeCategoryOrder(['Drinks', 'Wood'], ['wood', 'Snacks', 'Filament', 'Drinks']))
            .toEqual(['Drinks', 'Wood', 'Filament', 'Snacks']);
    });

    test('sanitize trims, drops empties and duplicates, rejects non-lists', () => {
        expect(sanitizeCategoryOrder([' Drinks ', '', 'drinks', 'Wood'])).toEqual(['Drinks', 'Wood']);
        expect(sanitizeCategoryOrder('Drinks')).toBeNull();
        expect(sanitizeCategoryOrder([1, 2])).toBeNull();
    });

    test('groupDrinks follows a custom order', () => {
        const groups = groupDrinks([{ category: 'Drinks', location: 'X' }, { category: 'Wood', location: 'X' }], ['Wood', 'Drinks']);
        expect(groups.map(g => g.category)).toEqual(['Wood', 'Drinks']);
    });
});

describe('groupDrinks', () => {
    test('orders categories Drinks, Wood, Filament, Per gewicht, then the rest alphabetically', () => {
        const item = (category: string | null, location = 'X') => ({ category, location });
        const groups = groupDrinks([
            item('Per gewicht'), item('Zagen'), item('Filament'), item('Andere'),
            item('wood'), item('Drinks', 'HTL-Fridge'), item('Drinks', 'Bar'), item(null),
        ]);
        expect(groups.map(g => `${g.category}@${g.location}`)).toEqual([
            'Drinks@Bar', 'Drinks@HTL-Fridge', 'wood@X', 'Filament@X', 'Per gewicht@X',
            'null@X', 'Andere@X', 'Zagen@X',
        ]);
    });
});

describe('buildPages', () => {
    const group = (category: string, n: number) => ({ location: null, category, items: Array.from({ length: n }, (_, i) => i) });
    const cats = (pages: ReturnType<typeof buildPages<number>>) => pages.map(p => p.map(s => `${s.category}:${s.items.length}`));

    // Drinks 8 (3 rows), Wood 3 (1 row), Nuts 1 (1 row), Filament 4 (2 rows)
    const shop = [group('Drinks', 8), group('Wood', 3), group('Per gewicht', 1), group('Filament', 4)];
    const firstThree = 3 * HEADER_PX + 5 * ROW_PX + 2 * GAP_PX;

    test('packs whole categories and moves the one that does not fit to the next page', () => {
        expect(cats(buildPages(shop, firstThree + 10))).toEqual([
            ['Drinks:8', 'Wood:3', 'Per gewicht:1'],
            ['Filament:4'],
        ]);
    });

    test('everything on one page when it fits', () => {
        const all = firstThree + GAP_PX + HEADER_PX + 2 * ROW_PX;
        expect(buildPages(shop, all)).toHaveLength(1);
    });

    test('a category taller than a page is split into parts', () => {
        const area = HEADER_PX + 4 * ROW_PX;   // 4 rows = 12 items
        const pages = buildPages([group('Drinks', 30)], area);
        expect(pages.map(p => [p[0].items.length, p[0].part, p[0].parts])).toEqual([[12, 1, 3], [12, 2, 3], [6, 3, 3]]);
    });

    test('wrapPage handles negatives and an empty list', () => {
        expect(wrapPage(5, 3)).toBe(2);
        expect(wrapPage(-1, 3)).toBe(2);
        expect(wrapPage(7, 0)).toBe(0);
    });
});
