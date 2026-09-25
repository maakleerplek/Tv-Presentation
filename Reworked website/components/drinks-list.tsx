'use client';

import React from 'react';
import { Coffee, Tag, MapPin, CheckCircle2, XCircle, Undo2, ShoppingCart, HandHeart, Plus, Minus, RotateCcw, Sparkles, ChevronLeft, ChevronRight, Pause } from 'lucide-react';

import QRCode from 'react-qr-code';
import { useScreenData } from '@/hooks/useScreenData';
import { useDrinksData } from '@/hooks/useDrinksData';
import { useChangelog } from '@/hooks/useChangelog';
import { useTvPage } from '@/hooks/useTvPage';
import { useCategoryOrder } from '@/hooks/useCategoryOrder';
import { DEFAULT_CATEGORY_ORDER, categoryRank } from '@/lib/category-order';
import type { ScreenData, DrinkItem, ChangelogEntry } from '@/lib/types';
import { PricingTable } from './pricing-table';
import type { DrinkWithChange } from '@/hooks/useDrinksData';

function HeaderRow({ category, location }: { category?: string | null; location?: string | null }) {
  return (
    <div data-tv-header className="border-b-2 border-[#2C1E16] pb-0.5 mb-0">
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
      data-tv-row
      className={`grid grid-cols-[48px_1fr_auto_auto_52px] gap-1.5 items-center py-0.5 shrink-0 ${
        drink._change === 'decreased' ? 'drink-sold' :
        drink._change === 'increased' ? 'drink-restocked' : ''
      }`}
    >
      <div className="w-12 h-12 relative border-2 border-[#2C1E16] shrink-0 bg-white overflow-hidden">
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
          {drink.stock === Infinity ? '∞' : drink.stock}
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

// Starting estimates in px for one item row and one category header. The TV
// replaces them with the heights it measures on screen, since fonts and QR
// padding make the real rows a few px taller than the Tailwind classes suggest.
export const ROW_PX = 56;
export const HEADER_PX = 42;
export const GAP_PX = 16;

export interface RowSizes { rowPx: number; headerPx: number }
/** Used until the item area has been measured (first render, tests). */
export const FALLBACK_AREA_PX = 480;

export interface PageSection<T> {
  location: string | null;
  category: string | null;
  items: T[];
  /** 1-based part number and total when a category spans several pages. */
  part: number;
  parts: number;
}

export type InventoryPage<T> = PageSection<T>[];

function sectionHeight(itemCount: number, { rowPx, headerPx }: RowSizes): number {
  return headerPx + Math.ceil(itemCount / 3) * rowPx;
}

/**
 * Pack whole categories onto pages, in order, as long as they fit in areaPx.
 * A category that doesn't fit on the current page moves in full to the next.
 * Only a category taller than a whole page is split, into page-sized parts.
 */
export function buildPages<T>(
  groups: { location: string | null; category: string | null; items: T[] }[],
  areaPx: number = FALLBACK_AREA_PX,
  sizes: RowSizes = { rowPx: ROW_PX, headerPx: HEADER_PX },
): InventoryPage<T>[] {
  const rowsPerPage = Math.max(1, Math.floor((areaPx - sizes.headerPx) / sizes.rowPx));
  const perPage = rowsPerPage * 3;

  const sections: PageSection<T>[] = [];
  for (const g of groups) {
    const parts = Math.max(1, Math.ceil(g.items.length / perPage));
    for (let i = 0; i < parts; i++) {
      sections.push({ ...g, items: g.items.slice(i * perPage, (i + 1) * perPage), part: i + 1, parts });
    }
  }

  const pages: InventoryPage<T>[] = [];
  let current: PageSection<T>[] = [];
  let used = 0;
  for (const sec of sections) {
    const h = sectionHeight(sec.items.length, sizes);
    const needed = current.length === 0 ? h : used + GAP_PX + h;
    if (current.length > 0 && needed > areaPx) {
      pages.push(current);
      current = [sec];
      used = h;
    } else {
      current.push(sec);
      used = needed;
    }
  }
  if (current.length > 0) pages.push(current);
  return pages;
}

/** The server hands out an unbounded page number; wrap it, negatives included. */
export function wrapPage(page: number, count: number): number {
  return count === 0 ? 0 : ((page % count) + count) % count;
}

/**
 * One block per location + category, in the order set in the admin panel. Blocks of the same
 * category in different locations stay next to each other.
 */
export function groupDrinks<T extends { location: string | null; category: string | null }>(
  drinks: T[],
  order: string[] = DEFAULT_CATEGORY_ORDER,
) {
  const groups = new Map<string, { location: string | null; category: string | null; items: T[] }>();
  for (const drink of drinks) {
    const key = `${drink.location ?? ''}::${drink.category ?? ''}`;
    if (!groups.has(key)) {
      groups.set(key, { location: drink.location, category: drink.category, items: [] });
    }
    groups.get(key)!.items.push(drink);
  }
  return [...groups.values()].sort((a, b) =>
    categoryRank(order, a.category) - categoryRank(order, b.category)
    || (a.category ?? '').localeCompare(b.category ?? '')
    || (a.location ?? '').localeCompare(b.location ?? ''));
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
  volunteer: 'volunteer drink:',
  add: 'restocked',
  remove: 'removed',
  set: 'set',
  create: 'added',
};

const ACTION_COLORS: Record<string, string> = {
  checkout: '#22C55E',
  volunteer: '#A855F7',
  add: '#3B82F6',
  remove: '#EF4444',
  set: '#F59E0B',
  create: '#A855F7',
};

const ACTION_ICONS: Record<string, React.ElementType> = {
  checkout: ShoppingCart,
  volunteer: HandHeart,
  add: Plus,
  remove: Minus,
  set: RotateCcw,
  create: Sparkles,
};

/**
 * SQLite's CURRENT_TIMESTAMP writes UTC as "2026-09-21 14:18:11" — a space
 * separator and no zone marker. JavaScript parses that form as *local* time, so
 * on a Brussels screen every entry read two hours old the moment it was written.
 * Pin it to UTC when the string carries no zone of its own.
 */
export function parseDbTimestamp(value: string): number {
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(value.trim());
  const normalised = hasZone ? value.trim() : value.trim().replace(' ', 'T') + 'Z';
  return new Date(normalised).getTime();
}

export function formatRelativeTime(isoString: string): string {
  try {
    const diffMs = Date.now() - parseDbTimestamp(isoString);
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
  const price = entry.action === 'volunteer' ? ' (free)' : entry.price != null ? ` €${entry.price.toFixed(2)}` : '';
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
    <div className="flex flex-col min-w-0 flex-1 pr-4">
      <span className="text-[10px] font-black uppercase tracking-widest text-[#2C1E16]/50 mb-0.5">Recent activity</span>
      {entries.slice(0, 12).map((entry) => {
        const Icon = ACTION_ICONS[entry.action] ?? ShoppingCart;
        const color = ACTION_COLORS[entry.action] ?? '#2C1E16';
        return (
          <div key={entry.id} className="flex items-center gap-1.5 min-w-0">
            <Icon className="w-3 h-3 shrink-0" style={{ color }} />
            <span className="text-xs font-bold text-[#2C1E16] truncate">
              {formatEntryLine(entry)}
            </span>
            <span className="text-[10px] text-[#2C1E16]/40 shrink-0 ml-auto whitespace-nowrap">
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
  const tvPage = useTvPage();
  const categoryOrder = useCategoryOrder();

  // Height of the item area (minus its p-4 padding), so pages hold what fits.
  const areaRef = React.useRef<HTMLDivElement>(null);
  const [areaPx, setAreaPx] = React.useState<number | null>(null);
  const [sizes, setSizes] = React.useState<RowSizes>({ rowPx: ROW_PX, headerPx: HEADER_PX });
  React.useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const measure = () => setAreaPx(Math.max(0, el.clientHeight - 32));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [loading]);

  // Read the real row and header heights off the page on screen.
  React.useEffect(() => {
    const el = areaRef.current;
    const row = el?.querySelector<HTMLElement>('[data-tv-row]')?.offsetHeight;
    const header = el?.querySelector<HTMLElement>('[data-tv-header]')?.offsetHeight;
    if (!row || !header) return;
    setSizes(prev => (prev.rowPx === row && prev.headerPx === header ? prev : { rowPx: row, headerPx: header }));
  }, [tvPage.page, loading, drinks.length]);

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

  const pages = buildPages(groupDrinks(drinks, categoryOrder), areaPx ?? FALLBACK_AREA_PX, sizes);
  const pageIndex = wrapPage(tvPage.page, pages.length);
  const page = pages[pageIndex] ?? [];

  return (
    <div className="flex-1 bg-[#F5F2EB] flex flex-col h-full overflow-hidden relative">

      <div className="p-2 border-b-2 border-[#2C1E16] bg-[#C8A98B] shrink-0">
        <h2 className="text-[#2C1E16] uppercase tracking-widest text-xs font-black flex items-center justify-center gap-2">
          <Coffee className="w-4 h-4" /> Inventory
          {pages.length > 1 && (
            <span className="flex items-center gap-1 text-[#2C1E16]/70">
              · {pageIndex + 1}/{pages.length}
              {!tvPage.cycling && <Pause className="w-3 h-3" />}
            </span>
          )}
        </h2>
        <p className="text-[#2C1E16]/60 text-[9px] font-bold uppercase tracking-wider text-center mt-0.5">
          Scan QR codes with scanner right of the TV
        </p>
      </div>

      {/* Only the current page is rendered: lighter for the Pi driving the TV.
          The key remounts it on a page change, which replays the slide-in. */}
      <div ref={areaRef} data-area={areaPx ?? ''} data-sizes={`${sizes.rowPx}/${sizes.headerPx}`} className="flex-1 min-h-0 overflow-hidden p-4">
        <div key={pageIndex} className="tv-page-in flex flex-col gap-4">
          {page.map((sec, si) => {
            const c1 = Math.ceil(sec.items.length / 3);
            const c2 = Math.ceil((sec.items.length - c1) / 2);
            const col1 = sec.items.slice(0, c1);
            const col2 = sec.items.slice(c1, c1 + c2);
            const col3 = sec.items.slice(c1 + c2);
            const category = sec.parts > 1 ? `${sec.category ?? ''} (${sec.part}/${sec.parts})` : sec.category;
            return (
              <div key={si} className="grid grid-cols-3 gap-x-3">
                <div className="flex flex-col gap-0">
                  <HeaderRow category={category} location={sec.location} />
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
        </div>
      </div>

      {/* Control Barcodes + Changelog */}
      <div className="px-3 py-1.5 border-t-2 border-[#2C1E16] bg-[#F5F2EB] flex flex-row items-center gap-4 shrink-0">
        <ChangelogPanel entries={changelog} />
        <div className="flex flex-col items-center gap-1.5 shrink-0">
          <div className="flex flex-row items-center gap-5">
            {[
              { label: 'Confirm', data: 'CONFIRM', icon: CheckCircle2, color: '#22C55E' },
              { label: 'Cancel', data: 'CANCEL', icon: XCircle, color: '#EF4444' },
              { label: 'Undo (Remove)', data: 'REMOVE', icon: Undo2, color: '#F59E0B' },
              { label: 'Prev page', data: 'PAGE-PREV', icon: ChevronLeft, color: '#2C1E16' },
              { label: 'Next page', data: 'PAGE-NEXT', icon: ChevronRight, color: '#2C1E16' },
            ].map((ctrl) => (
              <div key={ctrl.label} className="flex flex-col items-center gap-0.5">
                <div className="border-2 border-[#2C1E16] p-1 bg-white shadow-[2px_2px_0_0_#2C1E16]">
                  <QRCode value={ctrl.data} size={60} bgColor="#FFFFFF" fgColor="#2C1E16" />
                </div>
                <span className="text-[9px] font-black uppercase tracking-tight flex items-center gap-1">
                  <ctrl.icon className="w-2.5 h-2.5" style={{ color: ctrl.color }} /> {ctrl.label}
                </span>
              </div>
            ))}
          </div>
          {/* Volunteer drink: smaller and set apart, it is not a customer action */}
          <div className="flex flex-row items-center gap-1.5">
            <div className="border-2 border-[#2C1E16] p-0.5 bg-white shadow-[2px_2px_0_0_#2C1E16]">
              <QRCode value="VOLUNTEER" size={34} bgColor="#FFFFFF" fgColor="#2C1E16" />
            </div>
            <span className="text-[9px] font-black uppercase tracking-tight flex items-center gap-1">
              <HandHeart className="w-2.5 h-2.5" style={{ color: '#A855F7' }} /> Volunteer
            </span>
          </div>
        </div>
      </div>

      <PricingTable initialData={data || undefined} />
    </div>
  );
}
