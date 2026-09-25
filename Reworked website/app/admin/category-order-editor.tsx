'use client';

import { useState, useEffect, useTransition } from 'react';
import { ChevronUp, ChevronDown, Save, RotateCcw } from 'lucide-react';
import { saveCategoryOrderAction } from './actions';
import { DEFAULT_CATEGORY_ORDER, mergeCategoryOrder } from '@/lib/category-order';
import type { DrinkItem } from '@/lib/types';

/**
 * Order of the categories in the TV inventory. Lists the saved order plus any
 * category that exists in InvenTree now but isn't placed yet.
 */
export function CategoryOrderEditor({ saved }: { saved: string[] }) {
  const [order, setOrder] = useState<string[]>(saved);
  const [present, setPresent] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    fetch('/api/drinks-data', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : []))
      .then((drinks: DrinkItem[]) => {
        const cats = drinks.map(d => d.category).filter((c): c is string => !!c);
        setPresent(new Set(cats.map(c => c.toLowerCase())));
        setOrder(prev => mergeCategoryOrder(prev, cats));
      })
      .catch(() => {});
  }, []);

  function move(i: number, step: -1 | 1) {
    const j = i + step;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
    setStatus(null);
  }

  function save() {
    startTransition(async () => {
      const res = await saveCategoryOrderAction(order);
      setStatus(res.error ?? 'Saved. The TV picks it up within a minute.');
    });
  }

  return (
    <div className="bg-white border-2 border-[#2C1E16] shadow-[4px_4px_0_0_#2C1E16] p-4 max-w-md">
      <ol className="flex flex-col gap-2">
        {order.map((cat, i) => {
          const inStock = present.size === 0 || present.has(cat.toLowerCase());
          return (
            <li key={cat} className="flex items-center gap-3 border-2 border-[#2C1E16] px-3 py-2 bg-[#F5F2EB]">
              <span className="font-black w-6 text-right">{i + 1}.</span>
              <span className={`flex-1 font-bold uppercase tracking-wide ${inStock ? '' : 'opacity-40'}`}>
                {cat}
                {!inStock && <span className="ml-2 text-[10px] normal-case font-bold">(not on the TV now)</span>}
              </span>
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0}
                className="border-2 border-[#2C1E16] p-1 bg-white disabled:opacity-30" title="Move up">
                <ChevronUp className="w-4 h-4" />
              </button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === order.length - 1}
                className="border-2 border-[#2C1E16] p-1 bg-white disabled:opacity-30" title="Move down">
                <ChevronDown className="w-4 h-4" />
              </button>
            </li>
          );
        })}
      </ol>
      <div className="flex items-center gap-3 mt-4">
        <button type="button" onClick={save} disabled={isPending}
          className="flex items-center gap-2 bg-[#2C1E16] text-[#F5F2EB] px-4 py-2 font-bold uppercase text-sm disabled:opacity-50">
          <Save className="w-4 h-4" /> Save order
        </button>
        <button type="button" onClick={() => { setOrder(o => mergeCategoryOrder(DEFAULT_CATEGORY_ORDER, o)); setStatus(null); }}
          className="flex items-center gap-2 border-2 border-[#2C1E16] px-3 py-2 font-bold uppercase text-xs">
          <RotateCcw className="w-3 h-3" /> Default
        </button>
      </div>
      {status && <p className="text-xs font-bold mt-2">{status}</p>}
    </div>
  );
}
