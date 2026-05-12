'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Image from 'next/image';
import QRCode from 'react-qr-code';
import { Calendar, Globe, MapPin, Newspaper, Repeat, Tag } from 'lucide-react';
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
  // 'cover' = fill cleanly, 'contain' = show full image (bars visible but needed)
  const [imgFit, setImgFit] = useState<'cover' | 'contain'>('cover');
  const imgContainerRef = useRef<HTMLDivElement>(null);

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

  // Reset to cover optimistically whenever the carousel advances to a new item
  useEffect(() => { setImgFit('cover'); }, [currentIndex]);

  // Preload the next slide's image into the browser cache while the current one is showing
  useEffect(() => {
    if (carouselItems.length < 2) return;
    const nextIndex = (currentIndex + 1) % carouselItems.length;
    let url = carouselItems[nextIndex]?.imageUrl || '';
    if (url.startsWith('/')) url = `https://maakleerplek.be${url}`;
    if (!url) return;
    const img = new window.Image();
    img.src = url;
  }, [currentIndex, carouselItems]);

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
  const translatedTitle = currentItem.titleTranslated || currentItem.title;
  const translatedDescription = currentItem.descriptionTranslated || currentItem.description;

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
            className="absolute top-0 right-0 bottom-0 left-0 flex flex-col animate-slide-in"
          >
            <style dangerouslySetInnerHTML={{__html: `
              @keyframes slide-in {
                from { transform: translateX(100%); opacity: 0; }
                to   { transform: translateX(0);    opacity: 1; }
              }
              .animate-slide-in {
                animation: slide-in 0.55s cubic-bezier(0.16, 1, 0.3, 1) forwards;
              }
            `}} />
            {/* Top section: Image — 45% of card height.
                Adaptive fit: default to object-cover (no bars), but onLoad we check if the image's
                aspect ratio differs from the container's by more than 50%. If it does, we fall back
                to object-contain so extreme portrait/landscape images aren't badly cropped. The
                blurred backdrop still fills any remaining gaps. */}
            <div ref={imgContainerRef} className="basis-[45%] shrink-0 border-b-2 border-[#2C1E16] min-h-0 overflow-hidden relative flex items-center justify-center">
              {hasImage ? (
                <>
                  <Image
                    key={displayImage}
                    src={displayImage}
                    alt={currentItem.title}
                    fill
                    sizes="(min-width: 1280px) 720px, 50vw"
                    quality={55}
                    priority
                    onLoad={(e) => {
                      const img = e.currentTarget;
                      const container = imgContainerRef.current;
                      if (!container || !img.naturalWidth || !img.naturalHeight) return;
                      const imgRatio = img.naturalWidth / img.naturalHeight;
                      const containerRatio = container.clientWidth / container.clientHeight;
                      // Switch to contain only when the image is more than 1.6× wider or taller
                      // than the container — otherwise cover looks fine with minimal cropping
                      const ratio = imgRatio / containerRatio;
                      setImgFit(ratio > 1.6 || ratio < 0.625 ? 'contain' : 'cover');
                    }}
                    className={`relative z-10 w-full h-full transition-all duration-300 ${imgFit === 'cover' ? 'object-cover' : 'object-contain'}`}
                  />
                </>
              ) : (
                <Image
                  key="placeholder"
                  src="/HTL_logo_CMYK_white-04.svg"
                  alt="maakleerplek"
                  width={192}
                  height={64}
                  className="w-48 h-16 object-contain"
                />
              )}
            </div>

            {/* Bottom section: Content — flex-1 fills remaining height */}
            <div className="flex-1 px-6 pt-5 pb-4 flex flex-col gap-3 bg-[#F5F2EB] min-h-0 overflow-hidden">
              {/* Title */}
              <h3 className="shrink-0 text-lg xl:text-xl font-black leading-tight text-[#2C1E16] uppercase tracking-tighter line-clamp-2">
                {translatedTitle}
              </h3>

              {/* Chips row: type → price → date·time → location. One line, shrinks to fit. */}
              <div className="shrink-0 flex flex-row gap-2 flex-nowrap overflow-hidden items-center">
                {/* 1. Event type */}
                <span
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-black uppercase tracking-widest text-[#2C1E16] border-2 border-[#2C1E16] shrink-0"
                  style={{ backgroundColor: currentItem._color }}
                >
                  <currentItem._icon className="w-3.5 h-3.5 shrink-0" />
                  {currentItem.type === 'workshop' ? 'Workshop' : currentItem.type === 'recurring' ? 'Event' : 'Nieuws'}
                </span>

                {/* 2. Price — workshops only */}
                {currentItem.type === 'workshop' && price && (
                  <div className="flex items-center gap-2 text-xs font-black text-[#2C1E16] border-2 border-[#2C1E16] px-3 py-1.5 bg-[#FEF08A] shrink-0">
                    <Tag className="w-3.5 h-3.5 shrink-0" />
                    <span>{price}</span>
                  </div>
                )}

                {/* 3. Date + time combined */}
                {(dateLabel || time) && (
                  <div className="flex items-center gap-2 text-xs font-black text-[#2C1E16] border-2 border-[#2C1E16] px-3 py-1.5 bg-[#F5F2EB] shrink-0">
                    <Calendar className="w-3.5 h-3.5 shrink-0" />
                    <span>{dateLabel && time ? `${dateLabel} · ${time}` : dateLabel || time}</span>
                  </div>
                )}

                {/* 4. Location — skip "maakleerplek" (always this venue); News: show Globe */}
                {'_isNews' in currentItem && currentItem._isNews ? (
                  <div className="flex items-center gap-2 text-xs font-black text-[#2C1E16] border-2 border-[#2C1E16] px-3 py-1.5 bg-[#F5F2EB] shrink-0">
                    <Globe className="w-3.5 h-3.5 shrink-0" />
                    <span>maakleerplek.be</span>
                  </div>
                ) : location && location.toLowerCase() !== 'maakleerplek' ? (
                  <div className="flex items-center gap-2 text-xs font-black text-[#2C1E16] border-2 border-[#2C1E16] px-3 py-1.5 bg-[#F5F2EB] shrink-0">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    <span>{location}</span>
                  </div>
                ) : null}
              </div>

              {/* Description + QR side-by-side */}
              <div className="flex-1 min-h-0 flex flex-row items-start gap-4">
                {currentItem.description ? (
                  <p className="text-sm xl:text-base text-[#2C1E16] font-medium leading-normal flex-1 overflow-y-auto max-h-full pr-2">
                    {translatedDescription}
                  </p>
                ) : (
                  <div className="flex-1" />
                )}
                {currentItem.link && (
                  <div className="shrink-0 flex flex-col items-center gap-1 self-end">
                    <div className="border-2 border-[#2C1E16] p-1.5 bg-white">
                      <QRCode
                        value={currentItem.link}
                        size={80}
                        bgColor="#ffffff"
                        fgColor="#2C1E16"
                      />
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-[#2C1E16]/50">maakleerplek.be</span>
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
