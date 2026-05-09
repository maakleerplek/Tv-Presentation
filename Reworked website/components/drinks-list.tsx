'use client';

import { Coffee, QrCode } from 'lucide-react';
import Image from 'next/image';
import QRCode from 'react-qr-code';
import { useScreenData } from '@/hooks/useScreenData';
import { useDrinksData } from '@/hooks/useDrinksData';
import type { ScreenData, DrinkItem } from '@/lib/types';
import { PricingTable } from './pricing-table';
import type { DrinkWithChange } from '@/hooks/useDrinksData';

const HeaderRow = () => (
  <div className="grid grid-cols-[32px_1fr_auto_auto] gap-3 items-end border-b-2 border-[#2C1E16] pb-2 mb-1">
    <span className="col-start-2 text-xs text-[#2C1E16] font-black uppercase">Item</span>
    <span className="text-xs text-[#2C1E16] font-black uppercase text-center w-10">Stock</span>
    <span className="text-xs text-[#2C1E16] font-black uppercase text-right w-12">Prijs</span>
  </div>
);

function DrinkRow({ drink }: { drink: DrinkWithChange }) {
  return (
    <div
      className={`grid grid-cols-[32px_1fr_auto_auto] gap-3 items-center border-b border-[#2C1E16]/30 pb-2 shrink-0 rounded-sm ${
        drink._change === 'decreased' ? 'drink-sold' :
        drink._change === 'increased' ? 'drink-restocked' : ''
      }`}
    >
      <div className="w-8 h-8 relative border border-[#2C1E16] shrink-0 bg-[#E6D5B8] overflow-hidden">
        {drink.imageUrl ? (
          <Image
            src={drink.imageUrl}
            alt={drink.name}
            fill
            sizes="32px"
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-[8px] font-black text-[#2C1E16] uppercase leading-none text-center px-0.5">
            {drink.name.slice(0, 4)}
          </span>
        )}
      </div>
      <span className="text-sm text-[#2C1E16] font-bold uppercase truncate leading-none" title={drink.name}>
        {drink.name}
      </span>
      <span className="relative w-10 flex justify-center">
        <span
          className={`text-sm font-black leading-none transition-colors ${
            drink._change === 'decreased' ? 'text-red-600' :
            drink._change === 'increased' ? 'text-green-700' :
            'text-[#2C1E16]'
          }`}
        >
          {drink.stock}
        </span>
        {drink._delta !== null && (
          <span
            key={drink._delta + '-' + drink.name}
            className={`delta-badge pointer-events-none absolute -top-1 left-1/2 -translate-x-1/2 text-lg font-black px-2 py-0.5 border-2 whitespace-nowrap ${
              drink._delta < 0
                ? 'bg-red-500 text-white border-red-700'
                : 'bg-green-500 text-white border-green-700'
            }`}
          >
            {drink._delta > 0 ? '+' : ''}{drink._delta}
          </span>
        )}
      </span>
      <span className="text-sm font-black text-[#2C1E16] text-right w-12 leading-none">{drink.price}</span>
    </div>
  );
}

function groupDrinks(drinks: DrinkWithChange[]) {
  const groups = new Map<string, { location: string | null; category: string | null; items: DrinkWithChange[] }>();
  for (const drink of drinks) {
    const key = `${drink.location ?? ''}::${drink.category ?? ''}`;
    if (!groups.has(key)) {
      groups.set(key, { location: drink.location, category: drink.category, items: [] });
    }
    groups.get(key)!.items.push(drink);
  }
  return [...groups.values()];
}

export function DrinksList({ initialData }: { initialData?: ScreenData }) {
  const { data, loading, error } = useScreenData(initialData);
  const drinks = useDrinksData(initialData?.drinks);
  const PAYMENT_QR_URL = data?.config?.paymentQrUrl || '';

  if (loading) {
    return (
      <div className="flex-1 bg-[#F5F2EB] flex flex-col items-center justify-center p-6 h-full border-l-2 border-[#2C1E16]">
        <p className="text-[#2C1E16] font-black tracking-widest uppercase">Loading Inventory...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex-1 bg-[#F5F2EB] flex flex-col items-center justify-center p-6 h-full border-l-2 border-[#2C1E16]">
        <p className="text-red-600 font-bold uppercase">Error loading drinks</p>
      </div>
    );
  }

  const groups = groupDrinks(drinks);

  return (
    <div className="flex-1 bg-[#F5F2EB] flex flex-col h-full overflow-hidden">
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes sold-flash {
          0%   { background-color: transparent; }
          15%  { background-color: #FCA5A5; transform: translateX(-4px); }
          35%  { background-color: #FCA5A5; transform: translateX(4px); }
          55%  { background-color: #FCA5A5; transform: translateX(-2px); }
          75%  { background-color: #FCA5A5; transform: translateX(0); }
          100% { background-color: transparent; }
        }
        @keyframes stock-up-flash {
          0%   { background-color: transparent; }
          20%  { background-color: #86EFAC; }
          100% { background-color: transparent; }
        }
        @keyframes delta-float {
          0%   { opacity: 1; transform: translateY(0) scale(1); }
          20%  { opacity: 1; transform: translateY(-8px) scale(1.15); }
          100% { opacity: 0; transform: translateY(-52px) scale(0.9); }
        }
        .drink-sold {
          animation: sold-flash 1.2s ease-out forwards;
        }
        .drink-restocked {
          animation: stock-up-flash 1.2s ease-out forwards;
        }
        .delta-badge {
          animation: delta-float 2s ease-out forwards;
        }
      `}} />

      <div className="p-2 border-b-2 border-[#2C1E16] bg-[#C8A98B] shrink-0">
        <h2 className="text-[#2C1E16] uppercase tracking-widest text-xs font-black flex items-center justify-center gap-2">
          <Coffee className="w-4 h-4" /> Inventory
        </h2>
      </div>

      {/* Scrollable item area */}
      <div className="flex-1 flex flex-col p-4 min-h-0 overflow-y-auto gap-4">
        {groups.map((group, gi) => (
          <div key={gi} className="flex flex-col gap-1">
            {/* Group header */}
            <div className="flex items-baseline gap-2 mb-1">
              {group.category && (
                <span className="text-xs font-black uppercase tracking-widest text-[#2C1E16]">
                  {group.category}
                </span>
              )}
              {group.location && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#2C1E16]/60">
                  {group.location}
                </span>
              )}
            </div>
            <HeaderRow />
            {group.items.map((drink, idx) => (
              <DrinkRow key={idx} drink={drink} />
            ))}
          </div>
        ))}
      </div>

      {PAYMENT_QR_URL && (
        <div className="p-4 border-t-2 border-[#2C1E16] bg-[#F5F2EB] flex flex-row items-center justify-center gap-6 shrink-0">
          <div className="flex flex-col items-end gap-1 text-[#2C1E16]">
            <QrCode className="w-5 h-5" />
            <p className="text-[10px] uppercase tracking-widest font-black text-right leading-tight max-w-[160px]">Scan de barcode van je item met deze website</p>
          </div>
          <div className="border-2 border-[#2C1E16] p-1.5 bg-[#F5F2EB]">
            <QRCode value={PAYMENT_QR_URL} size={60} bgColor="#F5F2EB" fgColor="#2C1E16" />
          </div>
        </div>
      )}

      <PricingTable initialData={data || undefined} />
    </div>
  );
}
