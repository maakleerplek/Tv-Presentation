'use client';

import { useState, useEffect } from 'react';
import { CYCLE_MS, type TvPageView } from '@/lib/tv-state';

const POLL_INTERVAL_MS = 1_000;

/**
 * The page number the TV should show (not yet wrapped to the page count).
 *
 * Polls /api/tv-page every second, which also re-renders the TV each second.
 * Between polls, or when one fails, the page keeps cycling on the last known
 * timing so the screen never stalls on a network hiccup.
 */
export function useTvPage(): { page: number; cycling: boolean } {
    const [last, setLast] = useState<{ view: TvPageView; at: number }>({
        view: { page: 0, cycling: true, msIntoPage: 0 },
        at: 0,
    });
    const [now, setNow] = useState(0);

    useEffect(() => {
        let mounted = true;

        async function poll() {
            try {
                const res = await fetch('/api/tv-page', { cache: 'no-store' });
                if (res.ok) {
                    const view: TvPageView = await res.json();
                    const at = Date.now();
                    if (mounted) { setLast({ view, at }); setNow(at); }
                    return;
                }
            } catch {
                // keep cycling on the last known timing
            }
            if (mounted) setNow(Date.now());
        }

        poll();
        const interval = setInterval(poll, POLL_INTERVAL_MS);
        return () => { mounted = false; clearInterval(interval); };
    }, []);

    const { view, at } = last;
    if (!view.cycling) return { page: view.page, cycling: false };
    const extra = Math.floor((view.msIntoPage + now - at) / CYCLE_MS);
    return { page: view.page + extra, cycling: true };
}
