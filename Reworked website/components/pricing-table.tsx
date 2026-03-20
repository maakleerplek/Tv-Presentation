'use client';

import { Tag, Box } from 'lucide-react';
import { useScreenData } from '@/hooks/useScreenData';
import type { ScreenData } from '@/lib/types';

export function PricingTable({ initialData }: { initialData?: ScreenData }) {
  const { data } = useScreenData(initialData);

  const items = data?.pricing?.equipment || [];

  if (items.length === 0) return null;

  return (
    <div className="bg-[#F5F2EB] flex flex-col border-t-2 border-[#2C1E16] shrink-0">
      {/* Header styled exactly like DrinksList header */}
      <div className="p-2 border-b-2 border-[#2C1E16] bg-[#C8A98B] shrink-0">
        <h2 className="text-[#2C1E16] uppercase tracking-widest text-xs font-black flex items-center justify-center gap-2">
          <Box className="w-4 h-4" /> Machine Usage
        </h2>
      </div>
      
      <div className="flex flex-col">
        {items.map((item: { name: string, price: string }, idx: number) => (
          <div key={idx} className="grid grid-cols-[1fr_auto] gap-1 px-6 py-1.5 border-b border-[#2C1E16]/20 last:border-b-0">
            <span className="text-xs font-bold uppercase truncate text-[#2C1E16] leading-none" title={item.name}>
              {item.name}
            </span>
            <span className="text-xs font-black text-[#2C1E16] shrink-0 leading-none">
              {item.price}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
