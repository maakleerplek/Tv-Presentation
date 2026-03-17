
'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lightbulb } from 'lucide-react';
import QRCode from 'react-qr-code';
import Image from 'next/image';
import { useScreenData } from '@/hooks/useScreenData';

const DEFAULT_TIPS = [
  "Ruim je werkplek op na gebruik. Een nette ruimte is een veilige ruimte!",
  "Hulp nodig met een machine? Vraag een vrijwilliger met een blauwe lanyard.",
  "Vergeet niet je machinegebruik te registreren in het portaal.",
  "Laat 3D-printers niet onbeheerd achter bij lange prints. Kijk er regelmatig naar.",
  "Veiligheid eerst: draag altijd een veiligheidsbril bij het gebruik van gereedschap."
];

export function TipsFooter() {
  const { data } = useScreenData();
  const [currentIndex, setCurrentIndex] = useState(0);

  const tips =
    data?.config?.tips && data.config.tips.length > 0
      ? data.config.tips
      : DEFAULT_TIPS;

  const transitionTime = data?.config?.tipsTransitionTime ?? 10;
  const websiteUrl = data?.config?.websiteQrUrl || 'https://maakleerplek.be';
  const websiteLabel = websiteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const wikiUrl = data?.config?.wikiQrUrl || 'https://wiki.maakleerplek.be/a/general';
  const wikiLabel = wikiUrl.replace(/^https?:\/\//, '').replace(/\/$/, '').split('/')[0];

  // Reset index when tip list changes (e.g. on first data load)
  useEffect(() => {
    setCurrentIndex(0);
  }, [tips.length]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % tips.length);
    }, transitionTime * 1000);
    return () => clearInterval(timer);
  }, [tips.length, transitionTime]);

  return (
    <div className="h-full w-full bg-[#F5F2EB] text-[#2C1E16] flex items-center px-6 gap-8">
      {/* Left side: QR Code */}
      <div className="flex items-center gap-4 shrink-0">
        <div className="border-2 border-[#2C1E16] p-1.5 bg-[#F5F2EB]">
          <QRCode value={websiteUrl} size={60} bgColor="#F5F2EB" fgColor="#2C1E16" />
        </div>
        <div className="flex flex-col justify-center">
          <span className="text-[10px] font-black uppercase tracking-widest text-[#2C1E16]">Bezoek</span>
          <span className="text-sm font-black uppercase tracking-widest text-[#2C1E16]">{websiteLabel}</span>
        </div>
      </div>

      {/* Center: Tips */}
      <div className="flex-1 flex items-center h-full overflow-hidden gap-6">
        <div className="flex items-center gap-3 font-black uppercase tracking-widest text-sm shrink-0 bg-[#FECACA] text-[#2C1E16] px-4 py-2 border-2 border-[#2C1E16]">
          <Lightbulb className="w-5 h-5" />
          <span>Tip</span>
        </div>

        <div className="flex-1 relative h-full flex items-center overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              className="absolute text-xl font-bold uppercase tracking-tight"
            >
              {tips[currentIndex]}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Right side: Wiki QR + HTL Logo */}
      <div className="flex items-center gap-8 shrink-0 mr-4">
        <div className="flex items-center gap-4">
          <div className="flex flex-col justify-center text-right">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#2C1E16]">Wiki</span>
            <span className="text-sm font-black uppercase tracking-widest text-[#2C1E16]">{wikiLabel}</span>
          </div>
          <div className="border-2 border-[#2C1E16] p-1.5 bg-[#F5F2EB]">
            <QRCode value={wikiUrl} size={60} bgColor="#F5F2EB" fgColor="#2C1E16" />
          </div>
        </div>

        <div className="shrink-0 flex items-center h-full py-4 bg-[#F5F2EB]">
          <Image
            src="/HTL_logo_CMYK_white-04.svg"
            alt="HTL Logo"
            width={150}
            height={50}
            className="object-contain max-h-full brightness-0 opacity-80"
          />
        </div>
      </div>
    </div>
  );
}
