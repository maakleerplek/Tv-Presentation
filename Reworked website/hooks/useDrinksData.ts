'use client';

import { useState, useEffect, useRef } from 'react';
import type { DrinkItem } from '@/lib/types';

const POLL_INTERVAL_MS = 3_000;
const FETCH_TIMEOUT_MS = 5_000;

export type DrinkChange = 'decreased' | 'increased' | null;

export type DrinkWithChange = DrinkItem & { _change: DrinkChange; _delta: number | null };

function drinkKey(d: DrinkItem) {
    return `${d.name}::${d.location ?? ''}`;
}

/** Same rows with the same stock, price and picture: nothing to redraw. */
function sameList(a: DrinkItem[], b: DrinkItem[]) {
    if (a.length !== b.length) return false;
    return a.every((d, i) => {
        const e = b[i];
        return drinkKey(d) === drinkKey(e) && d.stock === e.stock && d.price === e.price
            && d.imageUrl === e.imageUrl && d.category === e.category;
    });
}

export function useDrinksData(initialDrinks?: DrinkItem[]) {
    const [drinks, setDrinks] = useState<DrinkWithChange[]>(
        () => (initialDrinks ?? []).map(d => ({ ...d, _change: null, _delta: null })),
    );
    const prevRef = useRef<Map<string, number>>(
        new Map((initialDrinks ?? []).map(d => [drinkKey(d), d.stock])),
    );
    const lastRef = useRef<DrinkItem[]>(initialDrinks ?? []);

    useEffect(() => {
        let mounted = true;
        let pollTimer: ReturnType<typeof setTimeout> | undefined;
        let clearTimer: ReturnType<typeof setTimeout> | undefined;

        async function fetchDrinks() {
            try {
                // A timeout, and the next poll only after this one ended: with a
                // slow InvenTree, setInterval stacked requests behind each other.
                const res = await fetch('/api/drinks-data', { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
                if (!res.ok) return;
                const fresh: DrinkItem[] = await res.json();

                if (!mounted || sameList(fresh, lastRef.current)) return;
                lastRef.current = fresh;

                const prev = prevRef.current;
                prevRef.current = new Map(fresh.map(d => [drinkKey(d), d.stock]));

                let changed = false;
                setDrinks(fresh.map(d => {
                    const oldStock = prev.get(drinkKey(d));
                    let change: DrinkChange = null;
                    let delta: number | null = null;
                    if (oldStock !== undefined) {
                        if (d.stock < oldStock) { change = 'decreased'; delta = d.stock - oldStock; }
                        else if (d.stock > oldStock) { change = 'increased'; delta = d.stock - oldStock; }
                    }
                    if (change) changed = true;
                    return { ...d, _change: change, _delta: delta };
                }));

                // Clear change flags after the animation completes
                if (changed) {
                    clearTimeout(clearTimer);
                    clearTimer = setTimeout(() => {
                        if (!mounted) return;
                        setDrinks(prev => prev.map(d => (d._change ? { ...d, _change: null, _delta: null } : d)));
                    }, 2000);
                }
            } catch {
                // silent — keep showing last known data
            } finally {
                if (mounted) pollTimer = setTimeout(fetchDrinks, POLL_INTERVAL_MS);
            }
        }

        // Fetch right away only when the server render brought no drinks.
        if (!initialDrinks?.length) fetchDrinks();
        else pollTimer = setTimeout(fetchDrinks, POLL_INTERVAL_MS);

        return () => {
            mounted = false;
            clearTimeout(pollTimer);
            clearTimeout(clearTimer);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return drinks;
}
