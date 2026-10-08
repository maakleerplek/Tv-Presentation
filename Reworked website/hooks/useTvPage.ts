'use client';

import { useState, useEffect } from 'react';
import { initialState, navigate, reportKiosk, view, CYCLE_MS, KIOSK_STALE_MS, type TvState } from '@/lib/tv-state';

/**
 * Keys the old Pi scanner pressed in this browser (xdotool, see
 * Interface-stock barcode_inventree.py). Kept as a fallback next to the
 * WebSocket below.
 */
export const TV_KEYS = {
    next: 'PageDown',   // PAGE-NEXT scanned
    prev: 'PageUp',     // PAGE-PREV scanned
    busy: 'F13',        // someone is shopping (repeated every 30 s)
    idle: 'F14',        // cart done (repeated every 30 s)
} as const;

/**
 * The touch kiosk (Interface-stock kiosk/src/tv.rs) runs on the same Pi and
 * pushes {"type": "busy" | "idle" | "next" | "prev"} over this WebSocket.
 * `?kiosk=ws://host:port` overrides it, `?kiosk=off` turns it off.
 */
export const KIOSK_WS_DEFAULT = 'ws://localhost:8765';
const KIOSK_WS_RETRY_MS = 5_000;

type KioskMessage = 'busy' | 'idle' | 'next' | 'prev';

function kioskUpdate(kind: KioskMessage, t: number): (s: TvState) => TvState {
    switch (kind) {
        case 'next': return s => navigate(s, 1, t);
        case 'prev': return s => navigate(s, -1, t);
        case 'busy': return s => reportKiosk(s, true, t);
        case 'idle': return s => reportKiosk(s, false, t);
    }
}

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
            const kind = (Object.keys(TV_KEYS) as KioskMessage[]).find(k => TV_KEYS[k] === e.key);
            if (!kind) return;
            const next = kioskUpdate(kind, t);
            e.preventDefault();   // PageUp/PageDown would scroll
            setState(next);
            setNow(t);
        }
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    // WebSocket from the touch kiosk. Reconnects every 5 s: the kiosk may
    // start after the browser or restart on an update.
    useEffect(() => {
        const url = new URLSearchParams(window.location.search).get('kiosk') ?? KIOSK_WS_DEFAULT;
        if (url === 'off') return;
        let ws: WebSocket | null = null;
        let retry: ReturnType<typeof setTimeout> | undefined;
        let stopped = false;
        const connect = () => {
            ws = new WebSocket(url);
            ws.onmessage = ev => {
                let kind: unknown;
                try { kind = JSON.parse(String(ev.data)).type; } catch { return; }
                if (kind !== 'busy' && kind !== 'idle' && kind !== 'next' && kind !== 'prev') return;
                const t = Date.now();
                setState(kioskUpdate(kind, t));
                setNow(t);
            };
            ws.onclose = () => {
                if (!stopped) retry = setTimeout(connect, KIOSK_WS_RETRY_MS);
            };
        };
        connect();
        return () => {
            stopped = true;
            clearTimeout(retry);
            ws?.close();
        };
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
