'use client';

import { useState, useEffect } from 'react';
import { initialState, navigate, reportKiosk, view, type TvState } from '@/lib/tv-state';

const TICK_MS = 1_000;

/**
 * Keys the Pi scanner presses in this browser (xdotool, see Interface-stock
 * barcode_inventree.py). The scanner and the TV run on the same Pi, so the
 * page switches the moment the barcode is read, without a server round trip.
 */
export const TV_KEYS = {
    next: 'PageDown',   // PAGE-NEXT scanned
    prev: 'PageUp',     // PAGE-PREV scanned
    busy: 'F13',        // someone is shopping (repeated every 30 s)
    idle: 'F14',        // cart done (repeated every 30 s)
} as const;

/**
 * The page number the TV shows (not yet wrapped to the page count), and
 * whether it is cycling. The logic lives in lib/tv-state.ts.
 */
export function useTvPage(): { page: number; cycling: boolean } {
    const [state, setState] = useState<TvState>(() => initialState(Date.now()));
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            const t = Date.now();
            let next: ((s: TvState) => TvState) | null = null;
            if (e.key === TV_KEYS.next) next = s => navigate(s, 1, t);
            else if (e.key === TV_KEYS.prev) next = s => navigate(s, -1, t);
            else if (e.key === TV_KEYS.busy) next = s => reportKiosk(s, true, t);
            else if (e.key === TV_KEYS.idle) next = s => reportKiosk(s, false, t);
            if (!next) return;
            e.preventDefault();   // PageUp/PageDown would scroll
            setState(next);
            setNow(t);
        }
        window.addEventListener('keydown', onKey);
        const tick = setInterval(() => setNow(Date.now()), TICK_MS);
        return () => { window.removeEventListener('keydown', onKey); clearInterval(tick); };
    }, []);

    const v = view(state, now);
    return { page: v.page, cycling: v.cycling };
}
