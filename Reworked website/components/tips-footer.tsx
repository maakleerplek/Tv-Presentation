'use client';

import QRCode from 'react-qr-code';
import Image from 'next/image';
import { ArrowBigDown } from 'lucide-react';
import { useScreenData } from '@/hooks/useScreenData';
import type { ScreenData } from '@/lib/types';

export function TipsFooter({ initialData }: { initialData?: ScreenData }) {
  const { data } = useScreenData(initialData);
  
  const websiteUrl = data?.config?.websiteQrUrl || 'https://maakleerplek.be';
  const websiteLabel = websiteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const stockUrl = data?.config?.stockQrUrl || 'https://stock.int.maakleerplek.be';
  const stockLabel = stockUrl.replace(/^https?:\/\//, '').replace(/\/$/, '').split('/')[0];

  return (
    <div className="h-full flex items-center justify-between px-8 border-t-2 border-[#2C1E16]">
      {/* Left side: Website QR */}
      <div className="flex items-center gap-4">
        <div className="border-2 border-[#2C1E16] p-1 bg-[#F5F2EB]">
          <QRCode value={websiteUrl} size={50} bgColor="#F5F2EB" fgColor="#2C1E16" />
        </div>
        <div className="flex flex-col justify-center">
          <span className="text-xs font-black uppercase tracking-widest text-[#2C1E16]">Bezoek</span>
          <span className="text-sm font-black uppercase tracking-widest text-[#2C1E16]">{websiteLabel}</span>
        </div>
      </div>

      {/* Middle: HTL Logo & Info. relative, so the scanner hint can hang off its
          right side without pushing the logo out of the centre. */}
      <div className="relative flex flex-col items-center justify-center h-full py-1">
        <Image
          src="/HTL_logo_CMYK_white-04.svg"
          alt="HTL Logo"
          width={130}
          height={40}
          className="object-contain brightness-0 mb-1"
        />
        <div className="flex flex-col items-center">
          <span className="text-xs font-black uppercase tracking-[0.2em] text-[#2C1E16] leading-none">
            v1.0
          </span>
        </div>

        {/* The barcode scanner sits below the TV, under the logo. */}
        <div className="absolute left-full ml-16 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none whitespace-nowrap">
          <div className="text-right leading-tight">
            <p className="text-xs font-black uppercase tracking-widest text-[#2C1E16]">Use barcode</p>
            <p className="text-xs font-black uppercase tracking-widest text-[#2C1E16]">scanner to</p>
            <p className="text-xs font-black uppercase tracking-widest text-[#2C1E16]">scan items</p>
          </div>
          <ArrowBigDown className="w-10 h-10 shrink-0 text-[#2C1E16]" strokeWidth={2} />
        </div>
      </div>

      {/* Right side: stock-app QR */}
      <div className="flex items-center gap-4">
        <div className="flex flex-col justify-center text-right">
          <span className="text-xs font-black uppercase tracking-widest text-[#2C1E16]">HTL stock</span>
          <span className="text-sm font-black uppercase tracking-widest text-[#2C1E16]">{stockLabel}</span>
        </div>
        <div className="border-2 border-[#2C1E16] p-1 bg-[#F5F2EB]">
          <QRCode value={stockUrl} size={50} bgColor="#F5F2EB" fgColor="#2C1E16" />
        </div>
      </div>
    </div>
  );
}
