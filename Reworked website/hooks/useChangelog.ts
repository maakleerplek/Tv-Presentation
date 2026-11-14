'use client';

import { useQuery } from '@tanstack/react-query';
import type { ChangelogEntry } from '@/lib/types';

const POLL_INTERVAL_MS = 15_000;

async function fetchChangelog(): Promise<ChangelogEntry[]> {
    const res = await fetch('/api/changelog', { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error('changelog failed');
    return res.json();
}

export function useChangelog(): ChangelogEntry[] {
    const { data } = useQuery({ queryKey: ['changelog'], queryFn: fetchChangelog, refetchInterval: POLL_INTERVAL_MS });
    return data ?? [];
}
