'use client';

import { useState, useEffect, useContext, createContext } from 'react';
import type { ScreenData } from '@/lib/types';

// NEXT_PUBLIC_ prefix required so the value is inlined at build time for client components
const POLL_INTERVAL_MS =
    parseInt(process.env.NEXT_PUBLIC_SCREEN_DATA_POLL_MINUTES || '5', 10) * 60 * 1000;

/**
 * When a ScreenDataOverrideProvider wraps a subtree, useScreenData returns the
 * provided data directly with no polling.  Used by the preview page.
 */
export const ScreenDataOverrideContext = createContext<ScreenData | null>(null);

export function ScreenDataOverrideProvider({
    data,
    children,
}: {
    data: ScreenData;
    children: React.ReactNode;
}) {
    return (
        <ScreenDataOverrideContext.Provider value={data}>
            {children}
        </ScreenDataOverrideContext.Provider>
    );
}

export function useScreenData(initialData?: ScreenData | null) {
    const override = useContext(ScreenDataOverrideContext);

    const [data, setData] = useState<ScreenData | null>(initialData || null);
    const [loading, setLoading] = useState(!initialData);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        // Preview / override mode: skip all polling
        if (override) return;

        let mounted = true;

        async function fetchData() {
            try {
                const response = await fetch('/api/screen-data');
                if (!response.ok) throw new Error('Network response was not ok');
                const json = await response.json();
                if (mounted) { setData(json); setError(null); }
            } catch (err) {
                if (mounted) setError(err instanceof Error ? err : new Error('Unknown error'));
            } finally {
                if (mounted) setLoading(false);
            }
        }

        if (!initialData) fetchData();
        const interval = setInterval(fetchData, POLL_INTERVAL_MS);
        return () => { mounted = false; clearInterval(interval); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Return override data if present, otherwise polled/initial data
    if (override) return { data: override, loading: false, error: null };
    return { data, loading, error };
}
