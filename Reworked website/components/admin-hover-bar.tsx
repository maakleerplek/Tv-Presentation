'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export function AdminHoverBar() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const handleMouseMove = () => {
      setIsVisible(true);
      
      // Clear the previous timeout
      clearTimeout(timeoutId);
      
      // Hide the bar after 3 seconds of no mouse movement
      timeoutId = setTimeout(() => {
        setIsVisible(false);
      }, 3000);
    };

    // Listen for mouse movement anywhere on the screen
    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      clearTimeout(timeoutId);
    };
  }, []);

  return (
    <div 
      className={`fixed top-0 left-0 right-0 h-32 z-[9999] pointer-events-none transition-all duration-500 ease-in-out flex justify-center pt-4 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
      }`}
    >
      <Link 
        href="/admin"
        className="pointer-events-auto bg-[#2C1E16] text-[#F5F2EB] px-8 py-3 rounded shadow-2xl font-black tracking-widest uppercase text-sm border border-white/20 hover:bg-[#4A3326] transition-colors"
      >
        Admin Panel
      </Link>
    </div>
  );
}
