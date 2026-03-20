'use client';

import Link from 'next/link';

export function AdminHoverBar() {
  return (
    <div className="absolute top-0 left-0 right-0 h-16 z-50 opacity-0 hover:opacity-100 transition-opacity duration-300 flex items-start justify-center pt-2">
      <Link 
        href="/admin"
        className="bg-[#2C1E16] text-[#F5F2EB] px-6 py-2 rounded shadow-lg font-black tracking-widest uppercase text-sm"
      >
        Admin Panel
      </Link>
    </div>
  );
}
