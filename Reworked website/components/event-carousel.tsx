'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Image from 'next/image';
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
      // News items don't have location/time usually, so adapt them slightly to fit the card UI
      const combined = [
        ...data.workshops.map((w: any) => ({ ...w, _icon: Calendar, _color: '#FEF08A' })),
        ...data.recurringEvents.map((r: any) => ({ ...r, _icon: Repeat, _color: '#BFDBFE' })),
        ...data.news.map((n: any) => ({ ...n, _icon: Newspaper, _color: '#BBF7D0', location: 'News Article' }))
      ].map((item: any) => {
        let title = item.title || '';
        let subtitle = '';
        if (title.includes(':')) {
          const parts = title.split(':');
          title = parts[0].trim();
          subtitle = parts.slice(1).join(':').trim();
        }
        return { ...item, title, subtitle };
      });
      setTimeout(() => {
        setCarouselItems(shuffleArray(combined));
        setCurrentIndex(0);
      }, 0); // Avoid synchronous setState warning
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
  // Determine if it has a valid image string or a default fallback
  const fallbackImage = `https://picsum.photos/seed/${currentItem.title.replace(/[^a-zA-Z]/g, '') || 'maakleerplek'}/1200/800`;
  let displayImage = currentItem.imageUrl || fallbackImage;

  if (displayImage.startsWith('/')) {
    // Note: since frontend is running in Docker alongside data-fetcher, relative paths
    // need to be pointed directly to the image origin or data-fetcher for SSR to work.
    if (currentItem.type === 'drinks') {
      displayImage = `http://data-fetcher:8080${displayImage}`;
    } else {
      displayImage = `https://maakleerplek.be${displayImage}`;
    }
  }

  // ... existing code ...
  return (
    <div className="flex-1 relative flex flex-col bg-[#F5F2EB] overflow-hidden">
      {/* Top Progress Bar */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#E5E0D8] z-50">
        <motion.div
          key={currentIndex}
          initial={{ width: "0%" }}
          animate={{ width: "100%" }}
          transition={{ duration: transitionTime, ease: "linear" }}
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
            {/* Top half: Image */}
            <div className="h-[45%] relative border-b-2 border-[#2C1E16] bg-[#2C1E16]">
              <Image
                src={displayImage}
                alt={currentItem.title}
                fill
                className="object-cover opacity-90"
                referrerPolicy="no-referrer"
                unoptimized
              />
            </div>

            {/* Bottom half: Content */}
            <div className="h-[55%] p-6 flex flex-col justify-center bg-[#F5F2EB]">
              {/* Event Type Tag */}
              <div className="mb-2">
                <span
                  className="inline-flex items-center gap-2 px-3 py-1 text-[10px] xl:text-xs font-black uppercase tracking-widest text-[#2C1E16] border-2 border-[#2C1E16]"
                  style={{ backgroundColor: currentItem._color }}
                >
                  <currentItem._icon className="w-3 h-3" />
                  {currentItem.type === 'workshop' ? 'Upcoming Workshop' : currentItem.type === 'recurring' ? 'Recurring Event' : 'Latest News'}
                </span>
              </div>

              <h3 className="text-2xl xl:text-3xl font-black mb-1 leading-tight text-[#2C1E16] uppercase tracking-tighter line-clamp-2 title-hyphenation">
                {currentItem.title}
              </h3>

              {currentItem.subtitle && (
                <h4 className="text-lg xl:text-xl font-bold mb-3 leading-tight text-[#2C1E16] opacity-80 line-clamp-2">
                  {currentItem.subtitle}
                </h4>
              )}

              <div className="flex flex-row gap-4 mb-3 flex-wrap">
                {(currentItem.time || currentItem.date) && (
                  <div
                    className="flex items-center gap-2 text-sm font-black text-[#2C1E16] border-2 border-[#2C1E16] px-3 py-1.5 bg-[#F5F2EB]"
                  >
                    <ClockIcon className="w-4 h-4" />
                    <span>{currentItem.date} {currentItem.time ? `- ${currentItem.time}` : ''}</span>
                  </div>
                )}
                {currentItem.location && (
                  <div className="flex items-center gap-2 text-sm font-black text-[#2C1E16] border-2 border-[#2C1E16] px-3 py-1.5 bg-[#F5F2EB]">
                    <MapPin className="w-4 h-4" />
                    <span>{currentItem.location}</span>
                  </div>
                )}
              </div>

              {currentItem.description ? (
                <p className="text-base xl:text-lg text-[#2C1E16] font-medium leading-normal max-w-2xl line-clamp-3">
                  {currentItem.description}
                </p>
              ) : (
                <div className="flex-1" />
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Progress Indicators */}
      <div className="absolute bottom-6 right-6 flex gap-2 z-30 max-w-[80%] overflow-hidden">
        {carouselItems.map((_, idx) => (
          <div
            key={idx}
            className={`h-3 transition-all duration-300 border border-[#2C1E16] shrink-0 ${idx === currentIndex ? 'w-8 bg-[#2C1E16]' : 'w-3 bg-[#F5F2EB]'
              }`}
          />
        ))}
      </div>
    </div>
  );
}
