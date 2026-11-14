'use client';

import { useQuery } from '@tanstack/react-query';
import type { ScreenData } from '@/lib/types';

export type { ScreenData };

// NEXT_PUBLIC_ prefix required so the value is inlined at build time for client components
const POLL_INTERVAL_MS =
    parseInt(process.env.NEXT_PUBLIC_SCREEN_DATA_POLL_MINUTES || '5', 10) * 60 * 1000;
const FETCH_TIMEOUT_MS = 30_000;

async function fetchScreenData(): Promise<ScreenData> {
    const response = await fetch('/api/screen-data', { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!response.ok) throw new Error('Network response was not ok');
    return response.json();
}

/** Every component shares the one query, so the page polls once. A failed poll keeps the last data. */
export function useScreenData(initialData?: ScreenData | null) {
    const { data, isPending, error } = useQuery({
        queryKey: ['screen-data'],
        queryFn: fetchScreenData,
        initialData: initialData ?? undefined,
        staleTime: POLL_INTERVAL_MS,
        refetchInterval: POLL_INTERVAL_MS,
    });
    return { data: data ?? null, loading: isPending, error };
}
