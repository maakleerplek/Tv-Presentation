'use client';

import { useState, useEffect } from 'react';
import type { ScreenData } from '@/lib/types';

// NEXT_PUBLIC_ prefix required so the value is inlined at build time for client components
const POLL_INTERVAL_MS =
    parseInt(process.env.NEXT_PUBLIC_SCREEN_DATA_POLL_MINUTES || '5', 10) * 60 * 1000;

export function useScreenData(initialData?: ScreenData | null) {
    const [data, setData] = useState<ScreenData | null>(initialData || null);
    const [loading, setLoading] = useState(!initialData);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        let mounted = true;

        async function fetchData() {
            try {
                const response = await fetch('/api/screen-data');
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                const json = await response.json();
                if (mounted) {
                    setData(json);
                    setError(null);
                }
            } catch (err) {
                if (mounted) {
                    setError(err instanceof Error ? err : new Error('Unknown error'));
                }
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        }

        // Only fetch if we don't have initial data OR if we want to start polling immediately
        if (!initialData) {
            fetchData();
        }

        // Re-fetch on the configured interval to keep display fresh without reloading
        const interval = setInterval(fetchData, POLL_INTERVAL_MS);

        return () => {
            mounted = false;
            clearInterval(interval);
        };
    }, [initialData]);

    return { data, loading, error };
}
