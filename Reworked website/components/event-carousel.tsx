'use client';

import { useState, useEffect, useMemo } from 'react';
import QRCode from 'react-qr-code';
import { Calendar, Clock as ClockIcon, Globe, MapPin, Newspaper, Repeat, Tag } from 'lucide-react';
import { useScreenData } from '@/hooks/useScreenData';
import { priorityOf, formatDutchDate } from '@/lib/utils';
import type { CalendarEvent, NewsItem, ScreenData } from '@/lib/types';

// Helper to shuffle an array (Fisher-Yates)
export function shuffleArray<T>(array: T[]): T[] {
  const a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Re-export as priorityRank so existing tests (carousel.test.ts) keep passing
export { priorityOf as priorityRank };
// Re-export so existing tests (carousel.test.ts) keep passing
export { formatDutchDate };

/** Runtime decoration fields added to each carousel item */
type CarouselDecoration = {
  _icon: React.ElementType;
  _color: string;
  _isNews?: boolean;
};

type CarouselItem = (CalendarEvent | NewsItem) & CarouselDecoration;

export function EventCarousel({ initialData }: { initialData?: ScreenData }) {
  const { data, loading, error } = useScreenData(initialData);
  const transitionTime = data?.config?.transitionTime ?? 15;
  const [currentIndex, setCurrentIndex] = useState(0);

  // Compute carousel items immediately (works during SSR)
  const carouselItems = useMemo(() => {
    if (!data) return [];

    const workshops = data.workshops.map((w) => ({ ...w, _icon: Calendar,  _color: '#FEF08A' }));
    const recurring = data.recurringEvents.map((r) => ({ ...r, _icon: Repeat,    _color: '#BFDBFE' }));
    const news      = data.news.map((n) => ({ ...n, _icon: Newspaper, _color: '#BBF7D0', _isNews: true }));

    // We combine them here. Shuffling during SSR can cause hydration mismatches,
    // so we just return the combined array.
    return [...workshops, ...recurring, ...news];
  }, [data]);

  // Use a simple ticker state to force CSS transition restart
  const [progressKey, setProgressKey] = useState(0);

  useEffect(() => {
    if (carouselItems.length === 0) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % carouselItems.length);
      setProgressKey(prev => prev + 1);
    }, transitionTime * 1000);
    return () => clearInterval(timer);
  }, [carouselItems.length, transitionTime]);

  if (loading) {
    return (
      <div className="flex-1 relative flex flex-col bg-[#F5F2EB] items-center justify-center">
        <p className="text-[#2C1E16] font-black tracking-widest uppercase">Evenementen laden...</p>
      </div>
    );
  }

  if (error || carouselItems.length === 0) {
    return (
      <div className="flex-1 relative flex flex-col bg-[#F5F2EB] items-center justify-center">
        <p className="text-[#2C1E16] font-black tracking-widest uppercase">Geen evenementen beschikbaar</p>
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
  const dateISO = 'dateISO' in currentItem ? currentItem.dateISO : undefined;
  const dateLabel = dateISO
    ? formatDutchDate(dateISO)
    : (currentItem.date || '');

  // Location and price only exist on CalendarEvent items
  const location = 'location' in currentItem ? currentItem.location : undefined;
  const price    = 'price' in currentItem ? currentItem.price : undefined;
  const time     = 'time' in currentItem ? currentItem.time : undefined;

  return (
    <div className="flex-1 relative flex flex-col bg-[#F5F2EB] overflow-hidden">
      {/* Top Progress Bar - Uses pure CSS animation via key remount */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#E5E0D8] z-50">
        <div
          key={progressKey}
          className="h-full bg-[#2C1E16] origin-left w-full"
          style={{
            animation: `progress-bar ${transitionTime}s linear forwards`
          }}
        />
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes progress-bar {
            from { transform: scaleX(0); }
            to { transform: scaleX(1); }
          }
        `}} />
      </div>

      <div className="flex-1 relative h-full mt-1.5">
          <div
            key={currentIndex}
            className="absolute top-0 right-0 bottom-0 left-0 flex flex-col animate-slide-fade"
          >
            <style dangerouslySetInnerHTML={{__html: `
              @keyframes slide-fade {
                from { opacity: 0; transform: translateY(15px) scale(0.98); }
                to { opacity: 1; transform: translateY(0) scale(1); }
              }
              .animate-slide-fade {
                animation: slide-fade 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
              }
            `}} />
            {/* Top section: Image — flex-1 gives 50% of the card height */}
            {/* Image area — blurred backdrop fills any gaps so there are never black bars */}
            <div className="flex-1 border-b-2 border-[#2C1E16] min-h-0 overflow-hidden relative flex items-center justify-center">
              {hasImage ? (
                <>
                  {/* Blurred background fill — same image, zoomed + blurred to eliminate letterbox bars */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    key={`bg-${displayImage}`}
                    src={displayImage}
                    alt=""
                    aria-hidden="true"
                    referrerPolicy="no-referrer"
                    className="absolute inset-0 w-full h-full object-cover scale-110 blur-xl opacity-60"
                  />
                  {/* Foreground image — always fully visible, no cropping */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    key={displayImage}
                    src={displayImage}
                    alt={currentItem.title}
                    referrerPolicy="no-referrer"
                    className="relative z-10 w-full h-full object-contain"
                  />
                </>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key="placeholder"
                  src="/HTL_logo_CMYK_white-04.svg"
                  alt="maakleerplek"
                  className="w-48 h-16 object-contain"
                />
              )}
            </div>

            {/* Bottom section: Content — flex-1 gives 50% of the card height */}
            <div className="flex-1 px-6 pt-5 pb-4 flex flex-col gap-3 bg-[#F5F2EB] min-h-0 overflow-hidden">
              {/* Title */}
              <h3 className="shrink-0 text-lg xl:text-xl font-black leading-tight text-[#2C1E16] uppercase tracking-tighter line-clamp-2">
                {currentItem.title}
              </h3>

              {/* Chips row: type, date, time, location/source */}
              <div className="shrink-0 flex flex-row gap-2 flex-wrap items-center">
                {/* Event type tag */}
                <span
                  className="inline-flex items-center gap-2 px-2.5 py-1 text-[10px] xl:text-xs font-black uppercase tracking-widest text-[#2C1E16] border-2 border-[#2C1E16]"
                  style={{ backgroundColor: currentItem._color }}
                >
                  <currentItem._icon className="w-3.5 h-3.5" />
                  {currentItem.type === 'workshop'
                    ? 'Workshop'
                    : currentItem.type === 'recurring'
                    ? 'Event'
                    : 'Nieuws'}
                </span>

                {dateLabel && (
                  <div className="flex items-center gap-2 text-sm font-black text-[#2C1E16] border-2 border-[#2C1E16] px-3 py-1 bg-[#F5F2EB]">
                    <Calendar className="w-4 h-4" />
                    <span>{dateLabel}</span>
                  </div>
                )}
                {time && (
                  <div className="flex items-center gap-2 text-sm font-black text-[#2C1E16] border-2 border-[#2C1E16] px-3 py-1 bg-[#F5F2EB]">
                    <ClockIcon className="w-4 h-4" />
                    <span>{time}</span>
                  </div>
                )}
                {/* Price chip — workshops only */}
                {currentItem.type === 'workshop' && price && (
                  <div className="flex items-center gap-2 text-sm font-black text-[#2C1E16] border-2 border-[#2C1E16] px-3 py-1 bg-[#FEF08A]">
                    <Tag className="w-4 h-4" />
                    <span>{price}</span>
                  </div>
                )}
                {/* Events: show MapPin for location; News: show Globe for source */}
                {'_isNews' in currentItem && currentItem._isNews ? (
                  <div className="flex items-center gap-2 text-sm font-black text-[#2C1E16] border-2 border-[#2C1E16] px-3 py-1 bg-[#F5F2EB]">
                    <Globe className="w-4 h-4" />
                    <span>maakleerplek.be</span>
                  </div>
                ) : location ? (
                  <div className="flex items-center gap-2 text-sm font-black text-[#2C1E16] border-2 border-[#2C1E16] px-3 py-1 bg-[#F5F2EB]">
                    <MapPin className="w-4 h-4" />
                    <span>{location}</span>
                  </div>
                ) : null}
              </div>

              {/* Description + QR side-by-side */}
              <div className="flex-1 min-h-0 flex flex-row items-start gap-4">
                {currentItem.description ? (
                  <p className="text-sm xl:text-base text-[#2C1E16] font-medium leading-normal flex-1 overflow-y-auto max-h-full pr-2">
                    {currentItem.description}
                  </p>
                ) : (
                  <div className="flex-1" />
                )}
                {currentItem.link && (
                  <div className="shrink-0 border-2 border-[#2C1E16] p-1.5 bg-white self-end">
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
          </div>
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
                className={`h-3 transition-colors duration-300 border border-[#2C1E16] shrink-0 ${
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
                className={`h-3 transition-colors duration-300 border border-[#2C1E16] shrink-0 ${
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
