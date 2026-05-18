'use client';

import React from 'react';
import { Coffee, Tag, MapPin, CheckCircle2, XCircle, Undo2, ShoppingCart, Plus, Minus, RotateCcw, Sparkles, ArrowRight } from 'lucide-react';

import QRCode from 'react-qr-code';
import { useScreenData } from '@/hooks/useScreenData';
import { useDrinksData } from '@/hooks/useDrinksData';
import { useChangelog } from '@/hooks/useChangelog';
import type { ScreenData, DrinkItem, ChangelogEntry } from '@/lib/types';
import { PricingTable } from './pricing-table';
import type { DrinkWithChange } from '@/hooks/useDrinksData';

function HeaderRow({ category, location }: { category?: string | null; location?: string | null }) {
  return (
    <div className="border-b-2 border-[#2C1E16] pb-0.5 mb-0">
      {/* Row 1: category + location tags — always rendered so all columns stay vertically aligned */}
      <div className="flex items-center gap-1.5 mb-0.5 min-h-[1rem]">
        {category && (
          <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-[#2C1E16]">
            <Tag className="w-2.5 h-2.5 shrink-0" />{category}
          </span>
        )}
        {location && (
          <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-[#2C1E16]/50">
            <MapPin className="w-2.5 h-2.5 shrink-0" />{location}
          </span>
        )}
      </div>
      {/* Row 2: column headers — always show Item aligned with Stock/Prijs/Scan */}
      <div className="grid grid-cols-[48px_1fr_auto_auto_52px] gap-1.5 items-end">
        <div />
        <span className="text-[10px] text-[#2C1E16] font-black uppercase text-center">Item</span>
        <span className="text-[10px] text-[#2C1E16] font-black uppercase text-center w-8">Stock</span>
        <span className="text-[10px] text-[#2C1E16] font-black uppercase text-right w-10">Prijs</span>
        <span className="text-[10px] text-[#2C1E16] font-black uppercase text-center">Scan</span>
      </div>
    </div>
  );
}

function DrinkRow({ drink }: { drink: DrinkWithChange }) {
  const qrValue = drink.barcode || drink.IPN || null;
  return (
    <div
      className={`grid grid-cols-[48px_1fr_auto_auto_52px] gap-1.5 items-center border-b border-[#2C1E16]/30 py-0.5 shrink-0 rounded-sm ${
        drink._change === 'decreased' ? 'drink-sold' :
        drink._change === 'increased' ? 'drink-restocked' : ''
      }`}
    >
      <div className="w-12 h-12 relative border border-[#2C1E16] shrink-0 bg-white overflow-hidden">
        {drink.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={drink.imageUrl}
            alt={drink.name}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-[8px] font-black text-[#2C1E16] uppercase leading-none text-center px-0.5">
            {drink.name.slice(0, 4)}
          </span>
        )}
      </div>
      <span className="text-xs text-[#2C1E16] font-bold uppercase leading-tight text-center break-words min-w-0 self-center line-clamp-2">
        {drink.name}
      </span>
      <span className="w-8 flex justify-center">
        <span
          className={`text-xs font-black leading-none ${
            drink._change === 'decreased' ? 'text-green-700' :
            drink._change === 'increased' ? 'text-blue-600' :
            'text-[#2C1E16]'
          }`}
        >
          {drink.stock}
        </span>
      </span>
      <span className="text-xs font-black text-[#2C1E16] text-right w-10 leading-none">{drink.price}</span>
      <div className="flex items-center justify-center">
        {qrValue ? (
          <div className="border-2 border-[#2C1E16] p-0.5 bg-white">
            <QRCode value={qrValue} size={44} bgColor="#ffffff" fgColor="#2C1E16" />
          </div>
        ) : (
          <span className="text-[8px] font-black text-[#2C1E16]/20 uppercase">—</span>
        )}
      </div>
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
      <div className="flex flex-col min-w-0 flex-1 pr-4">
        <span className="text-xs font-black uppercase tracking-widest text-[#2C1E16]/40">Recent activity</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-w-0 flex-1 pr-4 gap-0.5">
      <span className="text-[9px] font-black uppercase tracking-widest text-[#2C1E16]/50 mb-0.5">Recent activity</span>
      {entries.slice(0, 12).map((entry) => {
        const Icon = ACTION_ICONS[entry.action] ?? ShoppingCart;
        const color = ACTION_COLORS[entry.action] ?? '#2C1E16';
        return (
          <div key={entry.id} className="flex items-center gap-1.5 min-w-0">
            <Icon className="w-2.5 h-2.5 shrink-0" style={{ color }} />
            <span className="text-[10px] font-bold text-[#2C1E16] truncate">
              {formatEntryLine(entry)}
            </span>
            <span className="text-[9px] text-[#2C1E16]/40 shrink-0 ml-auto whitespace-nowrap">
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

      <div className="p-2 border-b-2 border-[#2C1E16] bg-[#C8A98B] shrink-0">
        <h2 className="text-[#2C1E16] uppercase tracking-widest text-xs font-black flex items-center justify-center gap-2">
          <Coffee className="w-4 h-4" /> Inventory
        </h2>
        <p className="text-[#2C1E16]/60 text-[9px] font-bold uppercase tracking-wider text-center mt-0.5">
          Scan QR codes with scanner right of the TV
        </p>
      </div>

      {/* Scrollable item area */}
      <div className="flex-1 flex flex-col p-4 min-h-0 overflow-y-auto gap-4">
        {groups.map((group, gi) => {
          const c1 = Math.ceil(group.items.length / 3);
          const c2 = Math.ceil((group.items.length - c1) / 2);
          const col1 = group.items.slice(0, c1);
          const col2 = group.items.slice(c1, c1 + c2);
          const col3 = group.items.slice(c1 + c2);
          return (
            <div key={gi} className="grid grid-cols-3 gap-x-3">
              <div className="flex flex-col gap-0">
                <HeaderRow category={group.category} location={group.location} />
                {col1.map((drink, idx) => <DrinkRow key={idx} drink={drink} />)}
              </div>
              <div className="flex flex-col gap-0">
                {col2.length > 0 && <HeaderRow />}
                {col2.map((drink, idx) => <DrinkRow key={idx} drink={drink} />)}
              </div>
              <div className="flex flex-col gap-0">
                {col3.length > 0 && <HeaderRow />}
                {col3.map((drink, idx) => <DrinkRow key={idx} drink={drink} />)}
              </div>
            </div>
          );
        })}
        {/* Barcode scanner hint */}
        <div className="flex items-center justify-end gap-2 pt-1 pb-0.5">
          <span className="text-[10px] font-black uppercase tracking-widest text-[#2C1E16]/50">
            Use barcode scanner to scan items
          </span>
          <ArrowRight className="w-4 h-4 shrink-0 text-[#2C1E16]/50" />
        </div>
      </div>

      {/* Control Barcodes + Changelog */}
      <div className="p-3 border-t-2 border-[#2C1E16] bg-[#F5F2EB] flex flex-row items-start gap-4 shrink-0">
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
