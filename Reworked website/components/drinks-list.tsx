'use client';

import { Coffee, QrCode } from 'lucide-react';
import QRCode from 'react-qr-code';
import { useScreenData } from '@/hooks/useScreenData';
import type { DrinkItem, ScreenData } from '@/lib/types';
import { PricingTable } from './pricing-table';

const HeaderRow = () => (
  <div className="grid grid-cols-[32px_1fr_auto_auto] gap-3 items-end border-b-2 border-[#2C1E16] pb-2 shrink-0">
    <span className="col-start-2 text-xs text-[#2C1E16] font-black uppercase">Item</span>
    <span className="text-xs text-[#2C1E16] font-black uppercase text-center w-10">Stock</span>
    <span className="text-xs text-[#2C1E16] font-black uppercase text-right w-12">Price</span>
  </div>
);

export function DrinksList({ initialData }: { initialData?: ScreenData }) {
  const { data, loading, error } = useScreenData(initialData);
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

  const DRINKS = data.drinks || [];

  return (
    <div className="flex-1 bg-[#F5F2EB] flex flex-col h-full overflow-hidden">
      <div className="p-2 border-b-2 border-[#2C1E16] bg-[#C8A98B] shrink-0">
        <h2 className="text-[#2C1E16] uppercase tracking-widest text-xs font-black flex items-center justify-center gap-2">
          <Coffee className="w-4 h-4" /> Drinks, Snacks & Materialen
        </h2>
      </div>

      {/* Scrollable item area — items packed from top, no gaps */}
      <div className="flex-1 flex flex-col p-6 min-h-0 overflow-y-auto">
        <div className="grid grid-cols-2 gap-x-10 gap-y-2 content-start">
          <HeaderRow />
          <HeaderRow />
          {DRINKS.map((drink: DrinkItem, idx: number) => (
            <div key={idx} className="grid grid-cols-[32px_1fr_auto_auto] gap-3 items-center border-b border-[#2C1E16]/30 pb-2 shrink-0">
              <div className="w-8 h-8 relative border border-[#2C1E16] shrink-0 bg-[#E6D5B8] overflow-hidden">
                {drink.imageUrl ? (
                  // drink.imageUrl is "/api/proxy-image?url=..." — served by Next.js server-side,
                  // which forwards to the data-fetcher. Works in both Docker and local dev.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={drink.imageUrl}
                    alt={drink.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="absolute top-0 right-0 bottom-0 left-0 flex items-center justify-center text-[8px] font-black text-[#2C1E16] uppercase leading-none text-center px-0.5">
                    {drink.name.slice(0, 4)}
                  </span>
                )}
              </div>
              <span className="text-sm text-[#2C1E16] font-bold uppercase truncate leading-none" title={drink.name}>{drink.name}</span>
              <span className="text-sm font-black text-[#2C1E16] text-center w-10 leading-none">{drink.stock}</span>
              <span className="text-sm font-black text-[#2C1E16] text-right w-12 leading-none">{drink.price}</span>
            </div>
          ))}
        </div>
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
