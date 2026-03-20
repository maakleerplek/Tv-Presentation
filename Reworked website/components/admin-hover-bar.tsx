'use client';

import Link from 'next/link';

export function AdminHoverBar() {
  return (
    <div className="absolute top-0 left-0 right-0 h-32 z-50 group flex items-start justify-center pt-2">
      {/* Invisible trigger area */}
      <div className="absolute inset-0 cursor-default" />
      
      {/* Button that appears on hover */}
      <Link 
        href="/admin"
        className="bg-[#2C1E16] text-[#F5F2EB] px-6 py-2 rounded shadow-lg font-black tracking-widest uppercase text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 relative z-10"
      >
        Admin Panel
      </Link>
    </div>
  );
}
