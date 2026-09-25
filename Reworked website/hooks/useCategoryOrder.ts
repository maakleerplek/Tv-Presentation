'use client';

import { useState, useEffect } from 'react';
import { DEFAULT_CATEGORY_ORDER } from '@/lib/category-order';

const POLL_INTERVAL_MS = 60_000;

/** The category order saved in the admin panel; the TV picks up a change within a minute. */
export function useCategoryOrder(): string[] {
    const [order, setOrder] = useState<string[]>(DEFAULT_CATEGORY_ORDER);

    useEffect(() => {
        let mounted = true;

        async function fetchOrder() {
            try {
                const res = await fetch('/api/tv-settings', { cache: 'no-store' });
                if (!res.ok) return;
                const json = await res.json();
                if (mounted && Array.isArray(json.categoryOrder)) setOrder(json.categoryOrder);
            } catch {
                // keep the last known order
            }
        }

        fetchOrder();
        const interval = setInterval(fetchOrder, POLL_INTERVAL_MS);
        return () => { mounted = false; clearInterval(interval); };
    }, []);

    return order;
}
