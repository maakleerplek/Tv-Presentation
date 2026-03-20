'use client';

import Link from 'next/link';

export function AdminHoverBar() {
  return (
    <div className="fixed top-0 left-0 right-0 h-32 z-[9999] group">
      {/* 
        This is the hit area. 
        It sits fixed at the top of the screen on top of everything else.
      */}
      <div className="absolute inset-0 bg-transparent group-hover:bg-black/10 transition-colors duration-300 pointer-events-auto" />
      
      {/* The actual button inside the hit area */}
      <div className="absolute top-0 left-0 right-0 pt-4 flex justify-center pointer-events-none">
        <Link 
          href="/admin"
          className="pointer-events-auto bg-[#2C1E16] text-[#F5F2EB] px-6 py-2 rounded shadow-lg font-black tracking-widest uppercase text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 translate-y-[-10px] group-hover:translate-y-0 transform"
        >
          Admin Panel
        </Link>
      </div>
    </div>
  );
}
