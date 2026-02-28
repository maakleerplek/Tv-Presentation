'use client';

import { useState, useEffect } from 'react';

export function Clock() {
  const [time, setTime] = useState<Date | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    setTimeout(() => setTime(new Date()), 0); // Avoid synchronous setState warning
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="border-b-2 border-[#2C1E16] p-4 flex flex-col items-center justify-center bg-[#F5F2EB] h-40 shrink-0">
      <div className="text-5xl font-black tracking-tighter text-[#2C1E16]">
        {time ? time.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }) : '--:--'}
      </div>
      <div className="text-[#2C1E16] mt-1 font-black uppercase tracking-widest text-xs text-center">
        {time ? time.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '---'}
      </div>
    </div>
  );
}
