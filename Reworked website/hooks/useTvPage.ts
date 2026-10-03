'use client';

import { useState, useEffect } from 'react';
import { initialState, navigate, reportKiosk, view, CYCLE_MS, KIOSK_STALE_MS, type TvState } from '@/lib/tv-state';

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
 * The page number the TV shows (not yet wrapped to the page count), whether it
 * is cycling, and whether someone is shopping. The logic lives in lib/tv-state.ts.
 */
export function useTvPage(): { page: number; cycling: boolean; busy: boolean } {
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
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    const v = view(state, now);

    // Wake up only when the view can change: the next page swap while cycling,
    // otherwise the end of a manual hold or of a silent busy kiosk. A 1 s tick
    // re-rendered the whole inventory (and its QR codes) every second on the Pi.
    useEffect(() => {
        const t = Date.now();
        const wakes = v.cycling
            ? [t + CYCLE_MS - v.msIntoPage]
            : [state.manualUntil, state.kioskBusy ? state.kioskSeenAt + KIOSK_STALE_MS : 0].filter(w => w > t);
        if (wakes.length === 0) return;
        const id = setTimeout(() => setNow(Date.now()), Math.max(50, Math.min(...wakes) - t));
        return () => clearTimeout(id);
    }, [state, now, v.cycling, v.msIntoPage]);

    return { page: v.page, cycling: v.cycling, busy: v.busy };
}
