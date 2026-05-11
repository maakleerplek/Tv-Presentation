'use client';

import { useState, useEffect, useRef } from 'react';
import type { DrinkItem } from '@/lib/types';

const POLL_INTERVAL_MS = 3_000;

export type DrinkChange = 'decreased' | 'increased' | null;

export type DrinkWithChange = DrinkItem & { _change: DrinkChange; _delta: number | null };

function drinkKey(d: DrinkItem) {
    return `${d.name}::${d.location ?? ''}`;
}

export function useDrinksData(initialDrinks?: DrinkItem[]) {
    const [drinks, setDrinks] = useState<DrinkWithChange[]>(
        () => (initialDrinks ?? []).map(d => ({ ...d, _change: null, _delta: null })),
    );
    const prevRef = useRef<Map<string, number>>(
        new Map((initialDrinks ?? []).map(d => [drinkKey(d), d.stock])),
    );

    useEffect(() => {
        let mounted = true;

        async function fetchDrinks() {
            try {
                const res = await fetch('/api/drinks-data');
                if (!res.ok) return;
                const fresh: DrinkItem[] = await res.json();

                if (!mounted) return;

                const prev = prevRef.current;
                const next = new Map(fresh.map(d => [drinkKey(d), d.stock]));

                setDrinks(fresh.map(d => {
                    const oldStock = prev.get(drinkKey(d));
                    let change: DrinkChange = null;
                    let delta: number | null = null;
                    if (oldStock !== undefined) {
                        if (d.stock < oldStock) { change = 'decreased'; delta = d.stock - oldStock; }
                        else if (d.stock > oldStock) { change = 'increased'; delta = d.stock - oldStock; }
                    }
                    return { ...d, _change: change, _delta: delta };
                }));

                prevRef.current = next;

                // Clear change flags after the animation completes
                setTimeout(() => {
                    if (!mounted) return;
                    setDrinks(prev => prev.map(d => ({ ...d, _change: null, _delta: null })));
                }, 2000);
            } catch {
                // silent — keep showing last known data
            }
        }

        const interval = setInterval(fetchDrinks, POLL_INTERVAL_MS);
        // Also fetch immediately (but only after mount, not if we have initial data)
        if (!initialDrinks?.length) fetchDrinks();

        return () => {
            mounted = false;
            clearInterval(interval);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return drinks;
}
