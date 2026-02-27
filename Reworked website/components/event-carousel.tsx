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
  const [currentIndex, setCurrentIndex] = useState(0);
  const [carouselItems, setCarouselItems] = useState<any[]>([]);

  // When data loads, combine the 3 buckets and shuffle
  useEffect(() => {
    if (data) {
      // News items don't have location/time usually, so adapt them slightly to fit the card UI
      const combined = [
        ...data.workshops.map(w => ({ ...w, _icon: Calendar, _color: '#FEF08A' })),
        ...data.recurringEvents.map(r => ({ ...r, _icon: Repeat, _color: '#BFDBFE' })),
        ...data.news.map(n => ({ ...n, _icon: Newspaper, _color: '#BBF7D0', location: 'News Article' }))
      ];
      setCarouselItems(shuffleArray(combined));
      setCurrentIndex(0);
    }
  }, [data]);

  useEffect(() => {
    if (carouselItems.length === 0) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % carouselItems.length);
    }, 15000); // Change every 15 seconds
    return () => clearInterval(timer);
  }, [carouselItems.length]);

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
  const fallbackImage = `https://picsum.photos/seed/${currentItem.title.replace(/[^a-zA-Z]/g, '')}/1200/800`;
  const displayImage = currentItem.imageUrl || fallbackImage;

  return (
    <div className="flex-1 relative flex flex-col bg-[#F5F2EB] overflow-hidden">
      <div className="absolute top-0 left-0 z-30 bg-[#2C1E16] text-[#F5F2EB] px-4 py-2 border-b-2 border-r-2 border-[#2C1E16]">
        <h2 className="uppercase tracking-widest text-xs font-black flex items-center gap-2">
          <currentItem._icon className="w-4 h-4" />
          {currentItem.type === 'workshop' ? 'Upcoming Workshop' :
            currentItem.type === 'recurring' ? 'Recurring Event' : 'Latest News'}
        </h2>
      </div>

      <div className="flex-1 relative h-full">
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
            <div className="h-1/2 relative border-b-2 border-[#2C1E16]">
              <Image
                src={displayImage}
                alt={currentItem.title}
                fill
                className="object-cover"
                referrerPolicy="no-referrer"
              />
            </div>

            {/* Bottom half: Content */}
            <div className="h-1/2 p-8 flex flex-col justify-center bg-[#F5F2EB]">
              <h3 className="text-5xl font-black mb-6 leading-none text-[#2C1E16] uppercase tracking-tighter line-clamp-2 title-hyphenation">
                {currentItem.title}
              </h3>

              <div className="flex flex-row gap-6 mb-6 flex-wrap">
                {(currentItem.time || currentItem.date) && (
                  <div
                    className="flex items-center gap-2 text-lg font-black text-[#2C1E16] border-2 border-[#2C1E16] px-4 py-2"
                    style={{ backgroundColor: currentItem._color }}
                  >
                    <ClockIcon className="w-5 h-5" />
                    <span>{currentItem.date} {currentItem.time ? `- ${currentItem.time}` : ''}</span>
                  </div>
                )}
                {currentItem.location && (
                  <div className="flex items-center gap-2 text-lg font-black text-[#2C1E16] border-2 border-[#2C1E16] px-4 py-2 bg-[#F5F2EB]">
                    <MapPin className="w-5 h-5" />
                    <span>{currentItem.location}</span>
                  </div>
                )}
              </div>

              <p className="text-2xl text-[#2C1E16] font-medium leading-snug max-w-2xl line-clamp-3">
                {currentItem.description}
              </p>
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
