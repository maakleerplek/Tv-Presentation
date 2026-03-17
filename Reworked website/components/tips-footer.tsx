'use client';

import QRCode from 'react-qr-code';
import Image from 'next/image';
import { useScreenData } from '@/hooks/useScreenData';

export function TipsFooter() {
  const { data } = useScreenData();
  
  const websiteUrl = data?.config?.websiteQrUrl || 'https://maakleerplek.be';
  const websiteLabel = websiteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const wikiUrl = data?.config?.wikiQrUrl || 'https://wiki.maakleerplek.be/a/general';
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

      {/* Middle: HTL Logo */}
      <div className="flex items-center h-full py-2">
        <Image
          src="/HTL_logo_CMYK_white-04.svg"
          alt="HTL Logo"
          width={150}
          height={50}
          className="object-contain max-h-full brightness-0 opacity-80"
        />
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
