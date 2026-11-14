'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { DrinkItem } from '@/lib/types';

const POLL_INTERVAL_MS = 3_000;
const FETCH_TIMEOUT_MS = 5_000;

export type DrinkChange = 'decreased' | 'increased' | null;

export type DrinkWithChange = DrinkItem & { _change: DrinkChange; _delta: number | null };

function drinkKey(d: DrinkItem) {
    return `${d.name}::${d.location ?? ''}`;
}

async function fetchDrinks(): Promise<DrinkItem[]> {
    const res = await fetch('/api/drinks-data', { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) throw new Error('drinks-data failed');
    return res.json();
}

export function useDrinksData(initialDrinks?: DrinkItem[]) {
    const [drinks, setDrinks] = useState<DrinkWithChange[]>(
        () => (initialDrinks ?? []).map(d => ({ ...d, _change: null, _delta: null })),
    );
    const prevRef = useRef<Map<string, number>>(
        new Map((initialDrinks ?? []).map(d => [drinkKey(d), d.stock])),
    );

    // TanStack never overlaps refetches of one query, so a slow InvenTree cannot stack requests.
    // A failed poll keeps the last data; unchanged data keeps its reference (structural sharing).
    const { data } = useQuery({
        queryKey: ['drinks'],
        queryFn: fetchDrinks,
        initialData: initialDrinks?.length ? initialDrinks : undefined,
        staleTime: POLL_INTERVAL_MS,
        refetchInterval: POLL_INTERVAL_MS,
    });

    useEffect(() => {
        if (!data) return;
        const prev = prevRef.current;
        prevRef.current = new Map(data.map(d => [drinkKey(d), d.stock]));

        let changed = false;
        setDrinks(data.map(d => {
            const oldStock = prev.get(drinkKey(d));
            let change: DrinkChange = null;
            let delta: number | null = null;
            if (oldStock !== undefined && d.stock !== oldStock) {
                change = d.stock < oldStock ? 'decreased' : 'increased';
                delta = d.stock - oldStock;
                changed = true;
            }
            return { ...d, _change: change, _delta: delta };
        }));

        // Clear change flags after the animation completes
        if (!changed) return;
        const t = setTimeout(() => {
            setDrinks(cur => cur.map(d => (d._change ? { ...d, _change: null, _delta: null } : d)));
        }, 2000);
        return () => clearTimeout(t);
    }, [data]);

    return drinks;
}
