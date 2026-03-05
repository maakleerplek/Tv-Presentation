'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Image from 'next/image';
import QRCode from 'react-qr-code';
import { Calendar, Clock as ClockIcon, Globe, MapPin, Newspaper, Repeat } from 'lucide-react';
import { useScreenData } from '@/hooks/useScreenData';

// Helper to shuffle an array (Fisher-Yates)
export function shuffleArray<T>(array: T[]): T[] {
  const a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Return the priority rank of a title given the ordered keyword list (lower = higher priority).
 *  Infinity = no match = lowest priority. */
export function priorityRank(title: string, keywords: string[]): number {
  const lower = title.toLowerCase();
  for (let i = 0; i < keywords.length; i++) {
    if (lower.includes(keywords[i])) return i;
  }
  return Infinity;
}

/** Format a YYYY-MM-DD string as a Dutch short date, e.g. "do 5 mrt" */
export function formatDutchDate(dateISO: string): string {
  const parts = dateISO.split('-').map(Number);
  if (parts.length !== 3) return dateISO;
  const [y, m, d] = parts;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('nl-BE', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function EventCarousel() {
  const { data, loading, error } = useScreenData();
  const transitionTime = data?.config?.transitionTime ?? 15;
  const priorityKeywords: string[] = data?.config?.eventPriority ?? [];
  const [currentIndex, setCurrentIndex] = useState(0);
  const [carouselItems, setCarouselItems] = useState<any[]>([]);

  // When data loads, combine the 3 buckets, shuffle non-priority items,
  // then place priority-matched items at the front in keyword order.
  useEffect(() => {
    if (!data) return;

    const workshops    = data.workshops.map((w: any)    => ({ ...w, _icon: Calendar,  _color: '#FEF08A' }));
    const recurring    = data.recurringEvents.map((r: any) => ({ ...r, _icon: Repeat,    _color: '#BFDBFE' }));
    // News items have no physical location — use a globe chip instead of a map pin
    const news         = data.news.map((n: any)         => ({ ...n, _icon: Newspaper, _color: '#BBF7D0', _isNews: true }));

    const all = [...workshops, ...recurring, ...news];

    if (priorityKeywords.length > 0) {
      // Split into prioritised (rank < Infinity) and the rest
      const prioritised = all
        .filter(item => priorityRank(item.title, priorityKeywords) < Infinity)
        .sort((a, b) => priorityRank(a.title, priorityKeywords) - priorityRank(b.title, priorityKeywords));
      const rest = shuffleArray(all.filter(item => priorityRank(item.title, priorityKeywords) === Infinity));
      setTimeout(() => { setCarouselItems([...prioritised, ...rest]); setCurrentIndex(0); }, 0);
    } else {
      setTimeout(() => { setCarouselItems(shuffleArray(all)); setCurrentIndex(0); }, 0);
    }
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Resolve image URL — already absolute from the scraper; guard against stray relative paths
  let displayImage = currentItem.imageUrl || '';
  if (displayImage.startsWith('/')) {
    displayImage = `https://maakleerplek.be${displayImage}`;
  }
  const hasImage = !!displayImage;

  // Format the date chip: prefer dateISO (reliable) over raw date string
  const dateLabel = currentItem.dateISO
    ? formatDutchDate(currentItem.dateISO)
    : (currentItem.date || '');

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

            {/* Bottom 55%: Content */}
            <div className="h-[55%] px-6 pt-5 pb-4 flex flex-col gap-3 bg-[#F5F2EB]">
              {/* Event type tag */}
              <div className="shrink-0">
                <span
                  className="inline-flex items-center gap-2 px-3 py-1 text-[10px] xl:text-xs font-black uppercase tracking-widest text-[#2C1E16] border-2 border-[#2C1E16]"
                  style={{ backgroundColor: currentItem._color }}
                >
                  <currentItem._icon className="w-3 h-3" />
                  {currentItem.type === 'workshop'
                    ? 'Aankomende Workshop'
                    : currentItem.type === 'recurring'
                    ? 'Terugkerend Evenement'
                    : 'Laatste Nieuws'}
                </span>
              </div>

              {/* Title */}
              <h3 className="shrink-0 text-2xl xl:text-3xl font-black leading-tight text-[#2C1E16] uppercase tracking-tighter line-clamp-2">
                {currentItem.title}
              </h3>

              {/* Chips row: date, time, location/source */}
              <div className="shrink-0 flex flex-row gap-3 flex-wrap">
                {dateLabel && (
                  <div className="flex items-center gap-2 text-sm font-black text-[#2C1E16] border-2 border-[#2C1E16] px-3 py-1.5 bg-[#F5F2EB]">
                    <Calendar className="w-4 h-4" />
                    <span>{dateLabel}</span>
                  </div>
                )}
                {currentItem.time && (
                  <div className="flex items-center gap-2 text-sm font-black text-[#2C1E16] border-2 border-[#2C1E16] px-3 py-1.5 bg-[#F5F2EB]">
                    <ClockIcon className="w-4 h-4" />
                    <span>{currentItem.time}</span>
                  </div>
                )}
                {/* Events: show MapPin for location; News: show Globe for source */}
                {currentItem._isNews ? (
                  <div className="flex items-center gap-2 text-sm font-black text-[#2C1E16] border-2 border-[#2C1E16] px-3 py-1.5 bg-[#F5F2EB]">
                    <Globe className="w-4 h-4" />
                    <span>maakleerplek.be</span>
                  </div>
                ) : currentItem.location ? (
                  <div className="flex items-center gap-2 text-sm font-black text-[#2C1E16] border-2 border-[#2C1E16] px-3 py-1.5 bg-[#F5F2EB]">
                    <MapPin className="w-4 h-4" />
                    <span>{currentItem.location}</span>
                  </div>
                ) : null}
              </div>

              {/* Description + QR side-by-side */}
              <div className="shrink-0 flex flex-row items-start gap-4">
                {currentItem.description ? (
                  <p className="text-base xl:text-lg text-[#2C1E16] font-medium leading-normal flex-1">
                    {currentItem.description}
                  </p>
                ) : (
                  <div className="flex-1" />
                )}
                {currentItem.link && (
                  <div className="shrink-0 border-2 border-[#2C1E16] p-1.5 bg-white">
                     <QRCode
                      value={currentItem.link}
                      size={80}
                      bgColor="#ffffff"
                      fgColor="#2C1E16"
                    />
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Progress dots — sliding window, max 7 visible */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-30 overflow-hidden">
        {(() => {
          const total = carouselItems.length;
          const WINDOW = 7;
          const EDGE = 2;

          if (total <= WINDOW) {
            return carouselItems.map((_, idx) => (
              <div
                key={idx}
                className={`h-3 transition-all duration-300 border border-[#2C1E16] shrink-0 ${
                  idx === currentIndex ? 'w-8 bg-[#2C1E16]' : 'w-3 bg-[#F5F2EB]'
                }`}
              />
            ));
          }

          const half = Math.floor(WINDOW / 2);
          let winStart = currentIndex - half;
          let winEnd   = currentIndex + half;
          if (winStart < 0) { winEnd -= winStart; winStart = 0; }
          if (winEnd >= total) { winStart -= (winEnd - total + 1); winEnd = total - 1; }
          winStart = Math.max(0, winStart);

          return Array.from({ length: WINDOW }, (_, i) => {
            const idx      = winStart + i;
            const isActive = idx === currentIndex;
            const distEdge = Math.min(i, WINDOW - 1 - i);
            const isEdge   = distEdge < EDGE && ((winStart > 0 && i < EDGE) || (winEnd < total - 1 && i >= WINDOW - EDGE));
            return (
              <div
                key={idx}
                className={`h-3 transition-all duration-300 border border-[#2C1E16] shrink-0 ${
                  isActive ? 'w-8 bg-[#2C1E16]' : isEdge ? 'w-2 bg-[#F5F2EB] opacity-40' : 'w-3 bg-[#F5F2EB]'
                }`}
              />
            );
          });
        })()}
      </div>
    </div>
  );
}
