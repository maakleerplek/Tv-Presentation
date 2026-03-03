'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Image from 'next/image';
import { QRCodeSVG } from 'qrcode.react';
import { Calendar, Clock as ClockIcon, MapPin, Newspaper, Repeat } from 'lucide-react';
import { useScreenData } from '@/hooks/useScreenData';

// Helper to shuffle the array
function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

export function EventCarousel() {
  const { data, loading, error } = useScreenData();
  const transitionTime = data?.config?.transitionTime || 15;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [carouselItems, setCarouselItems] = useState<any[]>([]);

  // When data loads, combine the 3 buckets and shuffle
  useEffect(() => {
    if (data) {
      const combined = [
        ...data.workshops.map((w: any) => ({ ...w, _icon: Calendar, _color: '#FEF08A' })),
        ...data.recurringEvents.map((r: any) => ({ ...r, _icon: Repeat, _color: '#BFDBFE' })),
        ...data.news.map((n: any) => ({ ...n, _icon: Newspaper, _color: '#BBF7D0', location: 'News Article' }))
      ].map((item: any) => ({ ...item, subtitle: '' }));
      setTimeout(() => {
        setCarouselItems(shuffleArray(combined));
        setCurrentIndex(0);
      }, 0);
    }
  }, [data]);

  useEffect(() => {
    if (carouselItems.length === 0) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % carouselItems.length);
    }, transitionTime * 1000);
    return () => clearInterval(timer);
  }, [carouselItems.length, transitionTime]);

  if (loading) {
    return (
      <div className="flex-1 relative flex flex-col bg-[#F5F2EB] items-center justify-center">
        <p className="text-[#2C1E16] font-black tracking-widest uppercase">Fetching Events...</p>
      </div>
    );
  }

  if (error || carouselItems.length === 0) {
    return (
      <div className="flex-1 relative flex flex-col bg-[#F5F2EB] items-center justify-center">
        <p className="text-[#2C1E16] font-black tracking-widest uppercase">No Events Available</p>
      </div>
    );
  }

  const currentItem = carouselItems[currentIndex];

  // Resolve image URL — no external fallback; missing image handled separately
  let displayImage = currentItem.imageUrl || '';
  if (displayImage.startsWith('/')) {
    displayImage = currentItem.type === 'drinks'
      ? `http://data-fetcher:8080${displayImage}`
      : `https://maakleerplek.be${displayImage}`;
  }
  const hasImage = !!displayImage;

  return (
    <div className="flex-1 relative flex flex-col bg-[#F5F2EB] overflow-hidden">
      {/* Top Progress Bar */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#E5E0D8] z-50">
        <motion.div
          key={currentIndex}
          initial={{ width: '0%' }}
          animate={{ width: '100%' }}
          transition={{ duration: transitionTime, ease: 'linear' }}
          className="h-full bg-[#2C1E16]"
        />
      </div>

      <div className="flex-1 relative h-full mt-1.5">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 flex flex-col"
          >
            {/* Top 45%: Image or branded fallback */}
            <div className="h-[45%] relative border-b-2 border-[#2C1E16] bg-[#2C1E16] shrink-0">
              {hasImage ? (
                <Image
                  src={displayImage}
                  alt={currentItem.title}
                  fill
                  className="object-cover opacity-90"
                  referrerPolicy="no-referrer"
                  unoptimized
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative w-48 h-16">
                    <Image
                      src="/HTL_logo_CMYK_white-04.svg"
                      alt="maakleerplek"
                      fill
                      className="object-contain"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Bottom 55%: Content — stacked from top */}
            <div className="h-[55%] px-6 pt-5 pb-4 flex flex-col gap-3 bg-[#F5F2EB]">
              {/* Event type tag */}
              <div className="shrink-0">
                <span
                  className="inline-flex items-center gap-2 px-3 py-1 text-[10px] xl:text-xs font-black uppercase tracking-widest text-[#2C1E16] border-2 border-[#2C1E16]"
                  style={{ backgroundColor: currentItem._color }}
                >
                  <currentItem._icon className="w-3 h-3" />
                  {currentItem.type === 'workshop'
                    ? 'Upcoming Workshop'
                    : currentItem.type === 'recurring'
                    ? 'Recurring Event'
                    : 'Latest News'}
                </span>
              </div>

              {/* Title */}
              <h3 className="shrink-0 text-2xl xl:text-3xl font-black leading-tight text-[#2C1E16] uppercase tracking-tighter line-clamp-2">
                {currentItem.title}
              </h3>

              {/* Date + Time chips — separate badges */}
              {(currentItem.date || currentItem.time) && (
                <div className="shrink-0 flex flex-row gap-3 flex-wrap">
                  {currentItem.date && (
                    <div className="flex items-center gap-2 text-sm font-black text-[#2C1E16] border-2 border-[#2C1E16] px-3 py-1.5 bg-[#F5F2EB]">
                      <Calendar className="w-4 h-4" />
                      <span>{currentItem.date}</span>
                    </div>
                  )}
                  {currentItem.time && (
                    <div className="flex items-center gap-2 text-sm font-black text-[#2C1E16] border-2 border-[#2C1E16] px-3 py-1.5 bg-[#F5F2EB]">
                      <ClockIcon className="w-4 h-4" />
                      <span>{currentItem.time}</span>
                    </div>
                  )}
                  {currentItem.location && (
                    <div className="flex items-center gap-2 text-sm font-black text-[#2C1E16] border-2 border-[#2C1E16] px-3 py-1.5 bg-[#F5F2EB]">
                      <MapPin className="w-4 h-4" />
                      <span>{currentItem.location}</span>
                    </div>
                  )}
                </div>
              )}
              {/* Location on its own row when there's no date/time (e.g. news) */}
              {!currentItem.date && !currentItem.time && currentItem.location && (
                <div className="shrink-0 flex flex-row gap-3">
                  <div className="flex items-center gap-2 text-sm font-black text-[#2C1E16] border-2 border-[#2C1E16] px-3 py-1.5 bg-[#F5F2EB]">
                    <MapPin className="w-4 h-4" />
                    <span>{currentItem.location}</span>
                  </div>
                </div>
              )}

              {/* Description + QR side-by-side — aligned to top, right below the tags */}
              <div className="shrink-0 flex flex-row items-start gap-4">
                {currentItem.description ? (
                  <p className="text-base xl:text-lg text-[#2C1E16] font-medium leading-normal line-clamp-3 flex-1">
                    {currentItem.description}
                  </p>
                ) : (
                  <div className="flex-1" />
                )}
                {currentItem.link && (
                  <div className="shrink-0 border-2 border-[#2C1E16] p-1.5 bg-white">
                    <QRCodeSVG
                      value={currentItem.link}
                      size={80}
                      bgColor="#ffffff"
                      fgColor="#2C1E16"
                      level="M"
                    />
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Progress dots — centered at the bottom, never overlapping QR */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-30">
        {carouselItems.map((_, idx) => (
          <div
            key={idx}
            className={`h-3 transition-all duration-300 border border-[#2C1E16] shrink-0 ${
              idx === currentIndex ? 'w-8 bg-[#2C1E16]' : 'w-3 bg-[#F5F2EB]'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
