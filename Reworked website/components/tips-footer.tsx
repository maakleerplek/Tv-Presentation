
'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lightbulb } from 'lucide-react';
import QRCode from 'react-qr-code';
import Image from 'next/image';

const TIPS = [
  "Please clean up your workspace after you are done. A clean space is a safe space!",
  "Need help with a machine? Ask one of the volunteers wearing a blue lanyard.",
  "Remember to log your machine usage time in the portal.",
  "Don't leave 3D printers unattended for long prints. Check on them regularly.",
  "Safety first: Always wear safety glasses when operating power tools."
];

export function TipsFooter() {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % TIPS.length);
    }, 10000); // Change every 10 seconds
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="h-full w-full bg-[#F5F2EB] text-[#2C1E16] flex items-center px-6 gap-8">
      {/* Left side: QR Code */}
      <div className="flex items-center gap-4 shrink-0">
        <div className="border-2 border-[#2C1E16] p-1.5 bg-[#F5F2EB]">
          <QRCode value="https://maakleerplek.be" size={60} bgColor="#F5F2EB" fgColor="#2C1E16" />
        </div>
        <div className="flex flex-col justify-center">
          <span className="text-[10px] font-black uppercase tracking-widest text-[#2C1E16]">Visit</span>
          <span className="text-sm font-black uppercase tracking-widest text-[#2C1E16]">maakleerplek.be</span>
        </div>
      </div>

      {/* Center: Tips */}
      <div className="flex-1 flex items-center h-full overflow-hidden gap-6">
        <div className="flex items-center gap-3 font-black uppercase tracking-widest text-sm shrink-0 bg-[#FECACA] text-[#2C1E16] px-4 py-2 border-2 border-[#2C1E16]">
          <Lightbulb className="w-5 h-5" />
          <span>Tip of the day</span>
        </div>

        <div className="flex-1 relative h-full flex items-center overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              className="absolute text-2xl font-bold uppercase tracking-tight"
            >
              {TIPS[currentIndex]}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Right side: HTL Logo */}
      <div className="shrink-0 flex items-center h-full py-4 bg-[#F5F2EB] mix-blend-difference invert mr-4">
        <Image
          src="/HTL_logo_CMYK_white-04.svg"
          alt="HTL Logo"
          width={180}
          height={60}
          className="object-contain max-h-full"
        />
      </div>
    </div>
  );
}
