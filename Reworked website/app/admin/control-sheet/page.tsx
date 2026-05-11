'use client';

import QRCode from 'react-qr-code';
import { ChevronLeft, Printer } from 'lucide-react';
import Link from 'next/link';

export default function ControlSheetPage() {
  const controls = [
    { label: 'CONFIRM', data: 'CONFIRM', description: 'Start checkout and generate payment QR' },
    { label: 'CANCEL', data: 'CANCEL', description: 'Clear the cart' },
    { label: 'REMOVE', data: 'REMOVE', description: 'Take a single item out of the cart' },
  ];

  return (
    <div className="min-h-screen bg-white p-8 text-[#2C1E16]">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-12 print:hidden">
          <Link href="/admin" className="flex items-center gap-2 text-sm font-bold uppercase hover:underline">
            <ChevronLeft className="w-4 h-4" /> Back to Admin
          </Link>
          <button 
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-[#2C1E16] text-white px-6 py-2 font-bold uppercase tracking-widest hover:bg-[#4A3B31] transition-colors"
          >
            <Printer className="w-5 h-5" /> Print Sheet
          </button>
        </div>

        <div className="text-center mb-16">
          <h1 className="text-4xl font-black uppercase tracking-widest mb-4">Scanner Control Sheet</h1>
          <p className="text-lg font-bold opacity-70">Tape this next to your scanner for quick commands</p>
        </div>

        <div className="grid grid-cols-1 gap-16">
          {controls.map((control) => (
            <div key={control.label} className="border-4 border-[#2C1E16] p-8 flex flex-col items-center gap-6 bg-white shadow-[8px_8px_0_0_#2C1E16]">
              <h2 className="text-3xl font-black uppercase tracking-widest border-b-4 border-[#2C1E16] pb-2 w-full text-center">
                {control.label}
              </h2>
              <div className="p-4 border-4 border-[#2C1E16] bg-white">
                <QRCode 
                  value={control.data} 
                  size={200} 
                  level="H"
                />
              </div>
              <p className="text-xl font-bold text-center max-w-md">
                {control.description}
              </p>
              <div className="text-sm font-black opacity-30 uppercase tracking-[0.5em] mt-4">
                {control.data}
              </div>
            </div>
          ))}
        </div>

        <footer className="mt-24 text-center border-t-4 border-[#2C1E16] pt-8 opacity-50">
          <p className="font-black uppercase tracking-widest text-xs">Maakleerplek TV Presentation System - Control Sheet</p>
        </footer>
      </div>

      <style jsx global>{`
        @media print {
          body { background: white; }
          .print\\:hidden { display: none !important; }
          .shadow-\\[8px_8px_0_0_\\#2C1E16\\] { box-shadow: none !important; }
          .border-4 { border-width: 2px !important; }
          .border-b-4 { border-bottom-width: 2px !important; }
        }
      `}</style>
    </div>
  );
}
