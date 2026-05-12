'use client';

import { useState, useEffect } from 'react';
import QRCode from 'react-qr-code';
import { ChevronLeft, Printer } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import type { DrinkItem } from '@/lib/types';

const CONTROLS = [
  { label: 'CONFIRM', data: 'CONFIRM', description: 'Start checkout / generate payment QR', color: '#86EFAC' },
  { label: 'CANCEL', data: 'CANCEL', description: 'Clear the cart', color: '#FCA5A5' },
  { label: 'UNDO / REMOVE', data: 'REMOVE', description: 'Remove last item from cart', color: '#FEF08A' },
];

export default function ControlSheetPage() {
  const [drinks, setDrinks] = useState<DrinkItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/drinks-data', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : [])
      .then(d => { setDrinks(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const drinksWithQR = drinks.filter(d => d.barcode || d.IPN);

  return (
    <div className="min-h-screen bg-white p-8 text-[#2C1E16]">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex justify-between items-center mb-12 print:hidden">
          <Link href="/admin" className="flex items-center gap-2 text-sm font-bold uppercase hover:underline">
            <ChevronLeft className="w-4 h-4" /> Back to Admin
          </Link>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-[#2C1E16] text-white px-6 py-2 font-bold uppercase tracking-widest hover:bg-[#4A3B31] transition-colors shadow-[4px_4px_0_0_rgba(0,0,0,0.2)]"
          >
            <Printer className="w-5 h-5" /> Print Sheet
          </button>
        </div>

        <h1 className="text-4xl font-black uppercase tracking-widest mb-2 text-center">Scanner Control Sheet</h1>
        <p className="text-center font-bold opacity-50 uppercase tracking-widest text-sm mb-16">Maakleerplek · Barcode Scanner Reference</p>

        {/* Special commands */}
        <section className="mb-16">
          <h2 className="text-xl font-black uppercase tracking-widest border-b-4 border-[#2C1E16] pb-2 mb-8">Scanner Commands</h2>
          <div className="grid grid-cols-3 gap-6">
            {CONTROLS.map(c => (
              <div key={c.label} className="border-4 border-[#2C1E16] flex flex-col items-center gap-4 p-6 shadow-[6px_6px_0_0_#2C1E16]">
                <div className="w-full text-center py-2 border-b-4 border-[#2C1E16]" style={{ backgroundColor: c.color }}>
                  <span className="text-2xl font-black uppercase tracking-widest">{c.label}</span>
                </div>
                <div className="border-2 border-[#2C1E16] p-2 bg-white">
                  <QRCode value={c.data} size={160} level="H" bgColor="#ffffff" fgColor="#2C1E16" />
                </div>
                <p className="text-base font-bold text-center leading-snug">{c.description}</p>
                <span className="text-sm font-black uppercase tracking-[0.3em] opacity-40">{c.data}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Inventory items */}
        <section>
          <h2 className="text-xl font-black uppercase tracking-widest border-b-4 border-[#2C1E16] pb-2 mb-8">
            Inventory Items
            {!loading && <span className="text-sm font-bold opacity-40 ml-3 normal-case tracking-normal">{drinksWithQR.length} items with barcode</span>}
          </h2>

          {loading && (
            <p className="font-black uppercase tracking-widest opacity-40 text-center py-12">Loading inventory…</p>
          )}

          {!loading && drinksWithQR.length === 0 && (
            <p className="font-black uppercase tracking-widest opacity-40 text-center py-12">No items with barcodes found in InvenTree.</p>
          )}

          <div className="grid grid-cols-4 gap-4">
            {drinksWithQR.map((drink, i) => {
              const qrValue = (drink.barcode || drink.IPN)!;
              return (
                <div key={i} className="border-2 border-[#2C1E16] flex flex-col items-center gap-3 p-4">
                  {/* Item image */}
                  {drink.imageUrl && (
                    <div className="w-12 h-12 relative border border-[#2C1E16] bg-[#E6D5B8] overflow-hidden shrink-0">
                      <Image src={drink.imageUrl} alt={drink.name} fill sizes="48px" className="object-cover" />
                    </div>
                  )}
                  <div className="border-2 border-[#2C1E16] p-1.5 bg-white">
                    <QRCode value={qrValue} size={96} bgColor="#ffffff" fgColor="#2C1E16" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-black uppercase leading-tight">{drink.name}</p>
                    <p className="text-xs font-bold opacity-40 mt-0.5">{drink.price}</p>
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-30 mt-1 break-all">{qrValue}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <footer className="mt-24 text-center border-t-4 border-[#2C1E16] pt-8 opacity-40 print:mt-12">
          <p className="font-black uppercase tracking-widest text-xs">Maakleerplek · Scanner Control Sheet</p>
        </footer>
      </div>

      <style jsx global>{`
        @media print {
          .print\\:hidden { display: none !important; }
          body { background: white; }
        }
      `}</style>
    </div>
  );
}
