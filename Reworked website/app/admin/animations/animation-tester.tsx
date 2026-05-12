'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import QRCode from 'react-qr-code';
import { AlertTriangle } from 'lucide-react';
import type { DrinkItem } from '@/lib/types';

type AnimState = { change: 'decreased' | 'increased' | null; delta: number | null };

const ANIM_DURATION_MS = 2000;

const ROW_STYLE = `
  @keyframes sold-flash {
    0%   { background-color: transparent; }
    15%  { background-color: #86EFAC; transform: translateX(-4px); }
    35%  { background-color: #86EFAC; transform: translateX(4px); }
    55%  { background-color: #86EFAC; transform: translateX(-2px); }
    75%  { background-color: #86EFAC; transform: translateX(0); }
    100% { background-color: transparent; }
  }
  @keyframes stock-up-flash {
    0%   { background-color: transparent; }
    20%  { background-color: #BFDBFE; }
    100% { background-color: transparent; }
  }
  @keyframes delta-float {
    0%   { opacity: 1; transform: translateY(0) scale(1); }
    20%  { opacity: 1; transform: translateY(-8px) scale(1.15); }
    100% { opacity: 0; transform: translateY(-52px) scale(0.9); }
  }
  .drink-sold     { animation: sold-flash     1.2s ease-out forwards; }
  .drink-restocked{ animation: stock-up-flash 1.2s ease-out forwards; }
  .delta-badge    { animation: delta-float    2s   ease-out forwards; }
`;

function DrinkRow({ drink, anim }: { drink: DrinkItem; anim: AnimState }) {
  const qrValue = drink.barcode || drink.IPN || null;

  return (
    <div
      className={`grid grid-cols-[32px_1fr_auto_auto_auto] gap-3 items-center border-b border-[#2C1E16]/30 pb-2 rounded-sm ${
        anim.change === 'decreased' ? 'drink-sold' :
        anim.change === 'increased' ? 'drink-restocked' : ''
      }`}
    >
      <div className="w-8 h-8 relative border border-[#2C1E16] bg-[#E6D5B8] overflow-hidden shrink-0">
        {drink.imageUrl ? (
          <Image src={drink.imageUrl} alt={drink.name} fill sizes="32px" className="object-cover" />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-[8px] font-black text-[#2C1E16] uppercase leading-none text-center px-0.5">
            {drink.name.slice(0, 4)}
          </span>
        )}
      </div>
      <span className="text-sm font-bold uppercase truncate leading-none text-[#2C1E16]">{drink.name}</span>
      <span className="relative w-10 flex justify-center">
        <span className={`text-sm font-black leading-none ${
          anim.change === 'decreased' ? 'text-green-700' :
          anim.change === 'increased' ? 'text-blue-600' :
          'text-[#2C1E16]'
        }`}>
          {drink.stock}
        </span>
        {anim.delta !== null && (
          <span
            className={`delta-badge pointer-events-none absolute -top-1 left-1/2 -translate-x-1/2 text-lg font-black px-2 py-0.5 border-2 whitespace-nowrap ${
              anim.delta < 0
                ? 'bg-green-500 text-white border-green-700'
                : 'bg-blue-400 text-white border-blue-600'
            }`}
          >
            {anim.delta > 0 ? '+' : ''}{anim.delta}
          </span>
        )}
      </span>
      <span className="text-sm font-black text-right w-12 leading-none text-[#2C1E16]">{drink.price}</span>
      <div className="flex flex-col items-center gap-0.5 shrink-0">
        {qrValue ? (
          <>
            <div className="border-2 border-[#2C1E16] p-1 bg-white">
              <QRCode value={qrValue} size={64} bgColor="#ffffff" fgColor="#2C1E16" />
            </div>
            <span className="text-[8px] font-black uppercase tracking-widest text-[#2C1E16]/50 max-w-[72px] truncate">{qrValue}</span>
          </>
        ) : (
          <span className="text-[8px] font-black uppercase tracking-widest text-[#2C1E16]/30 w-[72px] text-center">no barcode</span>
        )}
      </div>
    </div>
  );
}

const DELTAS = [-1, -2, -3, +1, +3];

function ClosingFlashTester() {
  const [showFlash, setShowFlash] = useState(false);

  function trigger() {
    setShowFlash(true);
    setTimeout(() => setShowFlash(false), 4000);
  }

  return (
    <div className="border-2 border-[#2C1E16] p-4 flex items-center gap-4 bg-red-50">
      {showFlash && (
        <div
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center pointer-events-none"
          style={{ animation: 'closing-flash 4s ease-in-out forwards' }}
        >
          <div style={{ animation: 'flash-text-in 4s ease-in-out forwards' }} className="text-center px-8">
            <AlertTriangle className="w-24 h-24 text-white mx-auto mb-6 drop-shadow-lg" />
            <p className="text-white font-black uppercase tracking-widest text-5xl leading-tight drop-shadow-lg">
              Test Evenement
            </p>
            <p className="text-white font-black uppercase tracking-widest text-3xl mt-4 drop-shadow-lg opacity-90">
              Eindigt over 5 min — 19:00
            </p>
          </div>
        </div>
      )}
      <p className="text-sm font-bold uppercase tracking-widest text-[#2C1E16] flex-1">
        Closing Flash — full-screen red warning overlay (4s)
      </p>
      <button
        onClick={trigger}
        disabled={showFlash}
        className="border-2 border-[#2C1E16] px-4 py-2 text-xs font-black uppercase bg-red-200 hover:bg-red-300 shadow-[2px_2px_0_0_#2C1E16] disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {showFlash ? 'Playing…' : 'Test Flash'}
      </button>
    </div>
  );
}

export function AnimationTester() {
  const [drinks, setDrinks] = useState<DrinkItem[]>([]);
  const [anims, setAnims] = useState<Record<string, AnimState>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/drinks-data', { cache: 'no-store' });
      if (res.ok) setDrinks(await res.json());
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  function trigger(name: string, delta: number) {
    clearTimeout(timers.current[name]);
    setAnims(prev => ({ ...prev, [name]: { change: delta < 0 ? 'decreased' : 'increased', delta } }));
    timers.current[name] = setTimeout(() => {
      setAnims(prev => ({ ...prev, [name]: { change: null, delta: null } }));
    }, ANIM_DURATION_MS);
  }

  const grouped = drinks.reduce<Record<string, { location: string | null; category: string | null; items: DrinkItem[] }>>(
    (acc, d) => {
      const key = `${d.location ?? ''}::${d.category ?? ''}`;
      if (!acc[key]) acc[key] = { location: d.location, category: d.category, items: [] };
      acc[key].items.push(d);
      return acc;
    }, {}
  );

  if (drinks.length === 0) {
    return <p className="text-[#2C1E16] font-black uppercase tracking-widest opacity-40">Loading inventory…</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <style dangerouslySetInnerHTML={{ __html: ROW_STYLE }} />
      <ClosingFlashTester />

      <div className="border-2 border-[#2C1E16] p-4 bg-[#C8A98B]/20 flex items-center gap-4">
        <p className="text-sm font-bold uppercase tracking-widest text-[#2C1E16] flex-1">
          Click a delta button to fire the animation on that row.
        </p>
        <button
          onClick={load}
          className="border-2 border-[#2C1E16] px-3 py-1 text-xs font-black uppercase bg-[#F5F2EB] hover:bg-[#E5E0D8] shadow-[2px_2px_0_0_#2C1E16]"
        >
          Reload
        </button>
      </div>

      {Object.values(grouped).map((group, gi) => (
        <div key={gi} className="flex flex-col gap-2">
          {(group.category || group.location) && (
            <div className="flex items-baseline gap-2 border-b-2 border-[#2C1E16] pb-1">
              {group.category && <span className="text-xs font-black uppercase tracking-widest text-[#2C1E16]">{group.category}</span>}
              {group.location && <span className="text-[10px] font-bold uppercase tracking-wider text-[#2C1E16]/60">{group.location}</span>}
            </div>
          )}
          {group.items.map((drink) => {
            const anim: AnimState = anims[drink.name] ?? { change: null, delta: null };
            return (
              <div key={drink.name} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <DrinkRow drink={drink} anim={anim} />
                </div>
                <div className="flex gap-1 shrink-0">
                  {DELTAS.map((d) => (
                    <button
                      key={d}
                      onClick={() => trigger(drink.name, d)}
                      className={`w-9 h-9 border-2 border-[#2C1E16] text-xs font-black shadow-[2px_2px_0_0_#2C1E16] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_0_#2C1E16] transition-all ${
                        d < 0 ? 'bg-red-100 hover:bg-red-200' : 'bg-green-100 hover:bg-green-200'
                      }`}
                    >
                      {d > 0 ? '+' : ''}{d}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
