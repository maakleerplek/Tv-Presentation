'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Image from 'next/image';
import { Calendar, Clock as ClockIcon, MapPin } from 'lucide-react';

const EVENTS = [
  {
    id: 1,
    title: "Intro to 3D Printing",
    time: "Today, 19:00 - 21:00",
    location: "Main Workshop",
    description: "Learn the basics of 3D printing, from finding models online to slicing and printing your first object. No prior experience required.",
    image: "https://picsum.photos/seed/3dprint/1200/800"
  },
  {
    id: 2,
    title: "Arduino Workshop",
    time: "Tomorrow, 18:30 - 20:30",
    location: "Electronics Lab",
    description: "Get started with microcontrollers. We'll build a simple temperature sensor and learn how to write basic C++ code for Arduino.",
    image: "https://picsum.photos/seed/arduino/1200/800"
  },
  {
    id: 3,
    title: "Woodworking Safety",
    time: "Saturday, 10:00 - 12:00",
    location: "Wood Shop",
    description: "Mandatory safety induction for using the table saw, band saw, and router table. Required for all new members wanting to use the wood shop.",
    image: "https://picsum.photos/seed/wood/1200/800"
  }
];

export function EventCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % EVENTS.length);
    }, 15000); // Change every 15 seconds
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex-1 relative flex flex-col bg-[#F5F2EB] overflow-hidden">
      <div className="absolute top-0 left-0 z-30 bg-[#2C1E16] text-[#F5F2EB] px-4 py-2 border-b-2 border-r-2 border-[#2C1E16]">
        <h2 className="uppercase tracking-widest text-xs font-black flex items-center gap-2">
          <Calendar className="w-4 h-4" /> Upcoming Events
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
                src={EVENTS[currentIndex].image}
                alt={EVENTS[currentIndex].title}
                fill
                className="object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            
            {/* Bottom half: Content */}
            <div className="h-1/2 p-8 flex flex-col justify-center bg-[#F5F2EB]">
              <h3 className="text-5xl font-black mb-6 leading-none text-[#2C1E16] uppercase tracking-tighter">
                {EVENTS[currentIndex].title}
              </h3>
              
              <div className="flex flex-row gap-6 mb-6">
                <div className="flex items-center gap-2 text-lg font-black text-[#2C1E16] border-2 border-[#2C1E16] px-4 py-2 bg-[#FEF08A]">
                  <ClockIcon className="w-5 h-5" />
                  <span>{EVENTS[currentIndex].time}</span>
                </div>
                <div className="flex items-center gap-2 text-lg font-black text-[#2C1E16] border-2 border-[#2C1E16] px-4 py-2 bg-[#BFDBFE]">
                  <MapPin className="w-5 h-5" />
                  <span>{EVENTS[currentIndex].location}</span>
                </div>
              </div>
              
              <p className="text-2xl text-[#2C1E16] font-medium leading-snug max-w-2xl">
                {EVENTS[currentIndex].description}
              </p>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
      
      {/* Progress Indicators */}
      <div className="absolute bottom-6 right-6 flex gap-2 z-30">
        {EVENTS.map((_, idx) => (
          <div 
            key={idx} 
            className={`h-3 transition-all duration-300 border border-[#2C1E16] ${
              idx === currentIndex ? 'w-8 bg-[#2C1E16]' : 'w-3 bg-[#F5F2EB]'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
