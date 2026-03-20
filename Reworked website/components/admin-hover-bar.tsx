'use client';

import Link from 'next/link';

export function AdminHoverBar() {
  return (
    <Link 
      href="/admin"
      className="absolute top-0 left-0 right-0 h-32 z-50 flex items-start justify-center pt-2 bg-transparent hover:bg-black/50 transition-colors duration-300 group"
    >
      <span className="bg-[#2C1E16] text-[#F5F2EB] px-6 py-2 rounded shadow-lg font-black tracking-widest uppercase text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        Admin Panel
      </span>
    </Link>
  );
}
