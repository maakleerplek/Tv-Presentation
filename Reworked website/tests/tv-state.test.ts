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

import { buildPages, wrapPage } from '@/components/drinks-list';

describe('buildPages', () => {
    const group = (category: string, n: number) => ({ location: null, category, items: Array.from({ length: n }, (_, i) => i) });

    test('one page per group, big groups split', () => {
        const pages = buildPages([group('Drinks', 5), group('Filament', 30)], 24);
        expect(pages.map(p => [p.category, p.items.length, p.part, p.parts])).toEqual([
            ['Drinks', 5, 1, 1],
            ['Filament', 24, 1, 2],
            ['Filament', 6, 2, 2],
        ]);
    });

    test('wrapPage handles negatives and an empty list', () => {
        expect(wrapPage(5, 3)).toBe(2);
        expect(wrapPage(-1, 3)).toBe(2);
        expect(wrapPage(7, 0)).toBe(0);
    });
});
