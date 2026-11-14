'use client';

import { useQuery } from '@tanstack/react-query';
import { DEFAULT_CATEGORY_ORDER } from '@/lib/category-order';

const POLL_INTERVAL_MS = 60_000;

async function fetchOrder(): Promise<string[]> {
    const res = await fetch('/api/tv-settings', { cache: 'no-store', signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error('tv-settings failed');
    const json = await res.json();
    if (!Array.isArray(json.categoryOrder)) throw new Error('no categoryOrder');
    return json.categoryOrder;
}

/** The category order saved in the admin panel; the TV picks up a change within a minute. */
export function useCategoryOrder(): string[] {
    const { data } = useQuery({ queryKey: ['category-order'], queryFn: fetchOrder, refetchInterval: POLL_INTERVAL_MS });
    return data ?? DEFAULT_CATEGORY_ORDER;
}
