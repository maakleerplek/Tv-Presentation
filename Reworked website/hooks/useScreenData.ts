'use client';

import { useState, useEffect, useContext, createContext } from 'react';
import type { ScreenData } from '@/lib/types';

export type { ScreenData };

// NEXT_PUBLIC_ prefix required so the value is inlined at build time for client components
const POLL_INTERVAL_MS =
    parseInt(process.env.NEXT_PUBLIC_SCREEN_DATA_POLL_MINUTES || '5', 10) * 60 * 1000;
const FETCH_TIMEOUT_MS = 30_000;

/**
 * When a ScreenDataOverrideProvider wraps a subtree, useScreenData returns the
 * provided data directly with no polling.  Used by the preview page.
 * The Provider component itself lives in ScreenDataOverrideProvider.tsx (JSX).
 */
export const ScreenDataOverrideContext = createContext<ScreenData | null>(null);

interface Snapshot { data: ScreenData | null; error: Error | null }

/*
 * One poller for the whole page. Six components call useScreenData; each used
 * to poll on its own and keep its own parsed copy of the payload.
 */
let shared: Snapshot = { data: null, error: null };
const listeners = new Set<(s: Snapshot) => void>();
let timer: ReturnType<typeof setInterval> | undefined;

async function fetchShared() {
    try {
        const response = await fetch('/api/screen-data', { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
        if (!response.ok) throw new Error('Network response was not ok');
        shared = { data: await response.json(), error: null };
    } catch (err) {
        shared = { data: shared.data, error: err instanceof Error ? err : new Error('Unknown error') };
    }
    listeners.forEach(l => l(shared));
}

function subscribe(listener: (s: Snapshot) => void, initialData?: ScreenData | null) {
    if (initialData && !shared.data) shared = { data: initialData, error: null };
    listeners.add(listener);
    if (listeners.size === 1) {
        if (!shared.data) fetchShared();
        timer = setInterval(fetchShared, POLL_INTERVAL_MS);
    } else if (shared.data || shared.error) {
        listener(shared);
    }
    return () => {
        listeners.delete(listener);
        if (listeners.size === 0) clearInterval(timer);
    };
}

export function useScreenData(initialData?: ScreenData | null) {
    const override = useContext(ScreenDataOverrideContext);

    const [snap, setSnap] = useState<Snapshot>(() => ({ data: shared.data ?? initialData ?? null, error: null }));
    const [loading, setLoading] = useState(!snap.data);

    useEffect(() => {
        // Preview / override mode: skip all polling
        if (override) return;
        return subscribe(s => { setSnap(s); setLoading(false); }, initialData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Return override data if present, otherwise polled/initial data
    if (override) return { data: override, loading: false, error: null };
    return { data: snap.data, loading, error: snap.error };
}
