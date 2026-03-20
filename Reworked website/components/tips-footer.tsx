'use client';

import QRCode from 'react-qr-code';
import Image from 'next/image';
import { useScreenData } from '@/hooks/useScreenData';
import type { ScreenData } from '@/lib/types';

export function TipsFooter({ initialData }: { initialData?: ScreenData }) {
  const { data } = useScreenData(initialData);
  
  const websiteUrl = data?.config?.websiteQrUrl || 'https://maakleerplek.be';
  const websiteLabel = websiteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const wikiUrl = data?.config?.wikiQrUrl || 'https://wiki.maakleerplek.be/en/hightechlab';
  const wikiLabel = wikiUrl.replace(/^https?:\/\//, '').replace(/\/$/, '').split('/')[0];

  return (
    <div className="h-full flex items-center justify-between px-8 border-t-2 border-[#2C1E16]">
      {/* Left side: Website QR */}
      <div className="flex items-center gap-4">
        <div className="border-2 border-[#2C1E16] p-1 bg-[#F5F2EB]">
          <QRCode value={websiteUrl} size={50} bgColor="#F5F2EB" fgColor="#2C1E16" />
        </div>
        <div className="flex flex-col justify-center">
          <span className="text-[10px] font-black uppercase tracking-widest text-[#2C1E16]">Bezoek</span>
          <span className="text-sm font-black uppercase tracking-widest text-[#2C1E16]">{websiteLabel}</span>
        </div>
      </div>

      {/* Middle: HTL Logo & Info */}
      <div className="flex flex-col items-center justify-center h-full py-1">
        <Image
          src="/HTL_logo_CMYK_white-04.svg"
          alt="HTL Logo"
          width={130}
          height={40}
          className="object-contain brightness-0 opacity-60 mb-1"
        />
        <div className="flex flex-col items-center">
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#2C1E16] opacity-40 leading-none">
            Beta 0.8
          </span>
          <span className="text-[7px] font-bold uppercase tracking-tight text-[#2C1E16] opacity-25 mt-1 leading-none">
            In development - info may be inaccurate
          </span>
        </div>
      </div>

      {/* Right side: Wiki QR */}
      <div className="flex items-center gap-4">
        <div className="flex flex-col justify-center text-right">
          <span className="text-[10px] font-black uppercase tracking-widest text-[#2C1E16]">Wiki</span>
          <span className="text-sm font-black uppercase tracking-widest text-[#2C1E16]">{wikiLabel}</span>
        </div>
        <div className="border-2 border-[#2C1E16] p-1 bg-[#F5F2EB]">
          <QRCode value={wikiUrl} size={50} bgColor="#F5F2EB" fgColor="#2C1E16" />
        </div>
      </div>
    </div>
  );
}
