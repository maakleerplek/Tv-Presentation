'use client';

import { useState, useEffect } from 'react';
import type { ChangelogEntry } from '@/lib/types';

const POLL_INTERVAL_MS = 15_000;

export function useChangelog() {
    const [entries, setEntries] = useState<ChangelogEntry[]>([]);

    useEffect(() => {
        let mounted = true;

        async function fetchChangelog() {
            try {
                const res = await fetch('/api/changelog');
                if (!res.ok) return;
                const json = await res.json();
                if (mounted) setEntries(json);
            } catch {
                // silently ignore, stale data is fine for a changelog
            }
        }

        fetchChangelog();
        const interval = setInterval(fetchChangelog, POLL_INTERVAL_MS);
        return () => { mounted = false; clearInterval(interval); };
    }, []);

    return entries;
}
