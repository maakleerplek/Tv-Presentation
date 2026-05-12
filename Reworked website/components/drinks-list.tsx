'use client';

import React from 'react';
import { Coffee, Tag, MapPin, CheckCircle2, XCircle, Undo2, ShoppingCart, Plus, Minus, RotateCcw, Sparkles } from 'lucide-react';
import Image from 'next/image';
import QRCode from 'react-qr-code';
import { useScreenData } from '@/hooks/useScreenData';
import { useDrinksData } from '@/hooks/useDrinksData';
import { useChangelog } from '@/hooks/useChangelog';
import type { ScreenData, DrinkItem, ChangelogEntry } from '@/lib/types';
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
            drink._change === 'decreased' ? 'text-green-700' :
            drink._change === 'increased' ? 'text-blue-600' :
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
                ? 'bg-green-500 text-white border-green-700'
                : 'bg-blue-400 text-white border-blue-600'
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

const SOURCE_LABELS: Record<string, string> = {
  'interface-stock': 'Barcode scanner',
  'checkout': 'Self-checkout',
  'volunteer-scanner': 'Volunteer',
  'inventory-overview': 'Volunteer',
  'inventree-sync': 'InvenTree',
};

const ACTION_VERBS: Record<string, string> = {
  checkout: 'bought',
  add: 'restocked',
  remove: 'removed',
  set: 'set',
  create: 'added',
};

const ACTION_COLORS: Record<string, string> = {
  checkout: '#22C55E',
  add: '#3B82F6',
  remove: '#EF4444',
  set: '#F59E0B',
  create: '#A855F7',
};

const ACTION_ICONS: Record<string, React.ElementType> = {
  checkout: ShoppingCart,
  add: Plus,
  remove: Minus,
  set: RotateCcw,
  create: Sparkles,
};

function formatRelativeTime(isoString: string): string {
  try {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffMin = Math.floor(diffMs / 60_000);
    if (diffMin < 1) return 'just now';
    if (diffMin === 1) return '1 min ago';
    if (diffMin < 60) return `${diffMin} min ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr === 1) return '1 hr ago';
    if (diffHr < 24) return `${diffHr} hr ago`;
    return `${Math.floor(diffHr / 24)}d ago`;
  } catch {
    return '';
  }
}

function formatEntryLine(entry: ChangelogEntry): string {
  const source = SOURCE_LABELS[entry.source] ?? entry.source;
  const verb = ACTION_VERBS[entry.action] ?? entry.action;
  const price = entry.price != null ? ` €${entry.price.toFixed(2)}` : '';
  return `From ${source}: ${verb} ${entry.quantity}× ${entry.item_name}${price}`;
}

function ChangelogPanel({ entries }: { entries: ChangelogEntry[] }) {
  const [, setTick] = React.useState(0);

  // Re-render every 30s so relative timestamps stay fresh
  React.useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  if (entries.length === 0) {
    return (
      <div className="flex flex-col justify-center min-w-0 flex-1 pr-4">
        <span className="text-[9px] font-black uppercase tracking-widest text-[#2C1E16]/40">Recent activity</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col justify-center min-w-0 flex-1 pr-4 gap-0.5">
      <span className="text-[9px] font-black uppercase tracking-widest text-[#2C1E16]/50 mb-0.5">Recent activity</span>
      {entries.slice(0, 5).map((entry) => {
        const Icon = ACTION_ICONS[entry.action] ?? ShoppingCart;
        const color = ACTION_COLORS[entry.action] ?? '#2C1E16';
        return (
          <div key={entry.id} className="flex items-center gap-1.5 min-w-0">
            <Icon className="w-2.5 h-2.5 shrink-0" style={{ color }} />
            <span className="text-[9px] font-bold text-[#2C1E16] truncate">
              {formatEntryLine(entry)}
            </span>
            <span className="text-[8px] text-[#2C1E16]/40 shrink-0 ml-auto whitespace-nowrap">
              {formatRelativeTime(entry.created_at)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function DrinksList({ initialData }: { initialData?: ScreenData }) {
  const { data, loading, error } = useScreenData(initialData);
  const drinks = useDrinksData(initialData?.drinks);
  const changelog = useChangelog();

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
          < Coffee className="w-4 h-4" /> Inventory
        </h2>
      </div>

      {/* Scrollable item area */}
      <div className="flex-1 flex flex-col p-4 min-h-0 overflow-y-auto gap-4">
        {groups.map((group, gi) => (
          <div key={gi} className="flex flex-col gap-1">
            {/* Group header */}
            <div className="flex items-center gap-3 mb-1">
              {group.category && (
                <span className="flex items-center gap-1 text-xs font-black uppercase tracking-widest text-[#2C1E16]">
                  <Tag className="w-3 h-3 shrink-0" />
                  {group.category}
                </span>
              )}
              {group.location && (
                <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#2C1E16]/60">
                  <MapPin className="w-3 h-3 shrink-0" />
                  {group.location}
                </span>
              )}
            </div>
            {(() => {
              const half = Math.ceil(group.items.length / 2);
              const left = group.items.slice(0, half);
              const right = group.items.slice(half);
              return (
                <div className="grid grid-cols-2 gap-x-4">
                  <div className="flex flex-col gap-1">
                    <HeaderRow />
                    {left.map((drink, idx) => <DrinkRow key={idx} drink={drink} />)}
                  </div>
                  <div className="flex flex-col gap-1">
                    {right.length > 0 && <HeaderRow />}
                    {right.map((drink, idx) => <DrinkRow key={idx} drink={drink} />)}
                  </div>
                </div>
              );
            })()}
          </div>
        ))}
      </div>

      {/* Control Barcodes + Changelog */}
      <div className="p-4 border-t-2 border-[#2C1E16] bg-[#F5F2EB] flex flex-row items-center gap-6 shrink-0">
        <ChangelogPanel entries={changelog} />
        <div className="flex flex-row items-center gap-6 shrink-0">
          {[
            { label: 'Confirm', data: 'CONFIRM', icon: CheckCircle2, color: '#22C55E' },
            { label: 'Cancel', data: 'CANCEL', icon: XCircle, color: '#EF4444' },
            { label: 'Undo (Remove)', data: 'REMOVE', icon: Undo2, color: '#F59E0B' },
          ].map((ctrl) => (
            <div key={ctrl.label} className="flex flex-col items-center gap-1">
              <div className="border-2 border-[#2C1E16] p-1.5 bg-white shadow-[2px_2px_0_0_#2C1E16]">
                <QRCode value={ctrl.data} size={60} bgColor="#FFFFFF" fgColor="#2C1E16" />
              </div>
              <span className="text-[9px] font-black uppercase tracking-tight flex items-center gap-1">
                <ctrl.icon className="w-2.5 h-2.5" style={{ color: ctrl.color }} /> {ctrl.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <PricingTable initialData={data || undefined} />
    </div>
  );
}
