'use client';

import React from 'react';
import { Tag, MapPin, ShoppingCart, HandHeart, Plus, Minus, RotateCcw, Sparkles, Pause } from 'lucide-react';

import QRCode from 'react-qr-code';
import { useScreenData } from '@/hooks/useScreenData';
import { useDrinksData } from '@/hooks/useDrinksData';
import { useChangelog } from '@/hooks/useChangelog';
import { useTvPage } from '@/hooks/useTvPage';
import { useCategoryOrder } from '@/hooks/useCategoryOrder';
import { DEFAULT_CATEGORY_ORDER, categoryRank } from '@/lib/category-order';
import type { ScreenData, DrinkItem, ChangelogEntry } from '@/lib/types';
import { PricingTable } from './pricing-table';
import { InfoBoard, BuySteps } from './info-board';
import type { DrinkWithChange } from '@/hooks/useDrinksData';

function HeaderRow({ category, location }: { category?: string | null; location?: string | null }) {
  return (
    // Fixed height, so the headers of the three columns always line up.
    <div data-tv-header className="h-[48px] flex flex-col justify-end border-b-2 border-[#2C1E16] pb-0.5">
      <div className="flex items-center gap-1.5 mb-0.5 h-4">
        {category && (
          <span className="flex items-center gap-1 text-sm font-black uppercase tracking-widest text-[#2C1E16]">
            <Tag className="w-3.5 h-3.5 shrink-0" />{category}
          </span>
        )}
        {location && (
          <span className="flex items-center gap-1 text-sm font-black uppercase tracking-wider text-[#2C1E16]">
            <MapPin className="w-3.5 h-3.5 shrink-0" />{location}
          </span>
        )}
      </div>
      <div className="grid grid-cols-[56px_1fr_auto_auto_52px] gap-1.5 items-end">
        <div />
        <span className="text-xs text-[#2C1E16] font-black uppercase text-center">Item</span>
        <span className="text-xs text-[#2C1E16] font-black uppercase text-center w-10">Stock</span>
        <span className="text-xs text-[#2C1E16] font-black uppercase text-right w-14">Prijs</span>
        <span className="text-xs text-[#2C1E16] font-black uppercase text-center">Scan</span>
      </div>
    </div>
  );
}

/** Polls hand out new objects every 3 s; only redraw a row when what it shows changed. */
function sameRow(a: { drink: DrinkWithChange }, b: { drink: DrinkWithChange }) {
  const x = a.drink, y = b.drink;
  return x.name === y.name && x.imageUrl === y.imageUrl && x.stock === y.stock && x.price === y.price
    && x.barcode === y.barcode && x.IPN === y.IPN && x._change === y._change;
}

/** One item row. Fixed height, and a name small enough to never be cut off. */
const DrinkRow = React.memo(function DrinkRow({ drink }: { drink: DrinkWithChange }) {
  const qrValue = drink.barcode || drink.IPN || null;
  return (
    <div
      data-tv-row
      className={`grid grid-cols-[56px_1fr_auto_auto_52px] gap-1.5 items-center h-[64px] shrink-0 ${
        drink._change === 'decreased' ? 'drink-sold' :
        drink._change === 'increased' ? 'drink-restocked' : ''
      }`}
    >
      <div className="w-14 h-14 relative border-2 border-[#2C1E16] shrink-0 bg-white overflow-hidden">
        {drink.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={drink.imageUrl}
            alt={drink.name}
            width={56}
            height={56}
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-[8px] font-black text-[#2C1E16] uppercase leading-none text-center px-0.5">
            {drink.name.slice(0, 4)}
          </span>
        )}
      </div>
      <span className="text-xs text-[#2C1E16] font-bold uppercase leading-tight text-center break-words min-w-0 self-center">
        {drink.name}
      </span>
      <span className="w-10 flex justify-center">
        <span
          className={`text-sm font-black leading-none ${
            drink._change === 'decreased' ? 'text-green-700' :
            drink._change === 'increased' ? 'text-blue-600' :
            'text-[#2C1E16]'
          }`}
        >
          {drink.stock === Infinity ? '∞' : drink.stock}
        </span>
      </span>
      <span className="text-sm font-black text-[#2C1E16] text-right w-14 leading-none">{drink.price}</span>
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
}, sameRow);

const rowKey = (d: DrinkWithChange) => `${d.IPN || d.barcode || d.name}::${d.location ?? ''}`;

// Heights in px of one item row (h-[64px]) and one category header (h-[48px]). The
// TV still measures them on screen, in case fonts render a pixel off.
export const ROW_PX = 64;
export const HEADER_PX = 48;
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

/** Where a sale happened. InvenTree-synced entries do not say, so they get nothing. */
const SOURCE_PLACES: Record<string, string> = {
  'interface-stock': 'kiosk',
  'checkout': 'app',
};

const ACTION_DETAILS: Record<string, string> = {
  volunteer: 'free volunteer drink',
  add: 'restocked',
  remove: 'removed',
  set: 'stock set',
  create: 'new item',
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

/** "Duvel ×1" plus a short note: where it was bought and the price, or what happened. */
export function formatEntryLine(entry: ChangelogEntry): { item: string; detail: string } {
  const item = `${entry.item_name} ×${entry.quantity}`;
  if (entry.action === 'checkout') {
    const price = entry.price != null ? `€${entry.price.toFixed(2)}` : '';
    return { item, detail: [SOURCE_PLACES[entry.source], price].filter(Boolean).join(' · ') };
  }
  return { item, detail: ACTION_DETAILS[entry.action] ?? entry.action };
}

const ChangelogPanel = React.memo(function ChangelogPanel({ entries }: { entries: ChangelogEntry[] }) {
  const [, setTick] = React.useState(0);

  // Re-render every 30s so relative timestamps stay fresh
  React.useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  if (entries.length === 0) {
    return (
      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-sm font-black uppercase tracking-widest text-[#2C1E16]">Recent activity</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-w-0 flex-1">
      <span className="text-sm font-black uppercase tracking-widest text-[#2C1E16] mb-0.5">Recent activity</span>
      {entries.slice(0, 14).map((entry) => {
        const Icon = ACTION_ICONS[entry.action] ?? ShoppingCart;
        const color = ACTION_COLORS[entry.action] ?? '#2C1E16';
        const { item, detail } = formatEntryLine(entry);
        return (
          <div key={entry.id} className="flex items-center gap-1.5 min-w-0">
            <Icon className="w-4 h-4 shrink-0" style={{ color }} />
            <span className="text-sm font-bold text-[#2C1E16] truncate">{item}</span>
            {detail && <span className="text-xs font-bold text-[#2C1E16]/60 shrink-0 whitespace-nowrap">{detail}</span>}
            <span className="text-xs font-bold text-[#2C1E16] shrink-0 ml-auto whitespace-nowrap">
              {formatRelativeTime(entry.created_at)}
            </span>
          </div>
        );
      })}
    </div>
  );
});

/** Recent sales and restocks, for the left column of the TV. */
export function RecentActivity() {
  const changelog = useChangelog();
  return (
    <div className="border-t-2 border-[#2C1E16] px-4 pt-4 pb-3 flex-1 min-h-0 overflow-hidden flex">
      <ChangelogPanel entries={changelog} />
    </div>
  );
}

export function DrinksList({ initialData }: { initialData?: ScreenData }) {
  const { data, loading } = useScreenData(initialData);
  const drinks = useDrinksData(initialData?.drinks);
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

  const pages = React.useMemo(
    () => buildPages(groupDrinks(drinks, categoryOrder), areaPx ?? FALLBACK_AREA_PX, sizes),
    [drinks, categoryOrder, areaPx, sizes],
  );

  if (loading) {
    return (
      <div className="flex-1 bg-[#F5F2EB] flex flex-col items-center justify-center p-6 h-full border-l-2 border-[#2C1E16]">
        <p className="text-[#2C1E16] font-black tracking-widest uppercase">Loading Inventory...</p>
      </div>
    );
  }

  if (!data) {   // a failed poll keeps the last data on screen
    return (
      <div className="flex-1 bg-[#F5F2EB] flex flex-col items-center justify-center p-6 h-full border-l-2 border-[#2C1E16]">
        <p className="text-red-600 font-bold uppercase">Error loading drinks</p>
      </div>
    );
  }

  const pageIndex = wrapPage(tvPage.page, pages.length);
  const page = pages[pageIndex] ?? [];

  return (
    <div className="flex-1 bg-[#F5F2EB] flex flex-col h-full overflow-hidden relative">

      {/* No title bar; a paused cycle still shows, for the admin. */}
      {!tvPage.cycling && <Pause className="absolute top-2 right-2 w-4 h-4 text-[#2C1E16]" />}

      {/* Only the current page is rendered: lighter for the Pi driving the TV.
          The key remounts it on a page change, which replays the slide-in. */}
      <div ref={areaRef} data-area={areaPx ?? ''} data-sizes={`${sizes.rowPx}/${sizes.headerPx}`} className="flex-1 min-h-0 overflow-hidden p-4">
        <div key={pageIndex} className="tv-page-in flex flex-col gap-4 h-full">
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
                  {col1.map((drink) => <DrinkRow key={rowKey(drink)} drink={drink} />)}
                </div>
                <div className="flex flex-col gap-0">
                  {col2.length > 0 && <HeaderRow />}
                  {col2.map((drink) => <DrinkRow key={rowKey(drink)} drink={drink} />)}
                </div>
                <div className="flex flex-col gap-0">
                  {col3.length > 0 && <HeaderRow />}
                  {col3.map((drink) => <DrinkRow key={rowKey(drink)} drink={drink} />)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* How to buy, and the floor plan permanently bottom right */}
      <div className="h-[370px] border-t-2 border-[#2C1E16] bg-[#F5F2EB] flex flex-row shrink-0">
        <div className="w-[300px] shrink-0 p-2">
          <BuySteps />
        </div>
        <div className="flex-1 min-w-0 border-l-2 border-[#2C1E16] p-2">
          <InfoBoard />
        </div>
      </div>

      <PricingTable initialData={data || undefined} />
    </div>
  );
}
