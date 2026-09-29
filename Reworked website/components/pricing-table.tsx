'use client';

import { Box, Cog, Drill, Zap } from 'lucide-react';
import { useScreenData } from '@/hooks/useScreenData';
import type { EquipmentPrice, ScreenData } from '@/lib/types';

function MachineIcon({ name }: { name: string }) {
  const n = name.toLowerCase();
  const cls = 'w-6 h-6 shrink-0 text-[#2C1E16]';
  if (n.includes('laser')) return <Zap className={cls} />;
  if (n.includes('cnc')) return <Drill className={cls} />;
  if (n.includes('3d') || n.includes('print')) return <Box className={cls} />;
  return <Cog className={cls} />;
}

/** "€5.00" → "€5", "€0.50" stays. */
function shortEuro(price: string) {
  return price.replace(/\.00$/, '');
}

function MachineCell({ item }: { item: EquipmentPrice }) {
  return (
    <div className="flex-1 min-w-0 flex items-center gap-2.5 px-4 py-1.5 border-l-2 border-[#2C1E16]">
      <MachineIcon name={item.name} />
      <div className="flex flex-col min-w-0">
        <span className="text-xs font-black uppercase tracking-widest text-[#2C1E16] leading-none truncate">
          {item.name}
        </span>
        <span className="text-xl font-black text-[#2C1E16] leading-tight whitespace-nowrap">
          {item.price}
          {item.unit && <span className="text-sm font-black text-[#2C1E16]"> / {item.unit}</span>}
        </span>
        {item.minimum && (
          <span className="text-xs font-black uppercase tracking-wider text-[#2C1E16] leading-none">
            min. {shortEuro(item.minimum)}
          </span>
        )}
      </div>
    </div>
  );
}

/** Machine usage prices from InvenTree, one cell per machine. */
export function PricingTable({ initialData }: { initialData?: ScreenData }) {
  const { data } = useScreenData(initialData);
  const items = data?.pricing?.equipment || [];

  if (items.length === 0) return null;

  return (
    <div className="flex flex-row items-stretch border-t-2 border-[#2C1E16] bg-[#F5F2EB] shrink-0">
      <div className="flex items-center gap-2 px-4 bg-[#C8A98B] shrink-0">
        <Cog className="w-4 h-4 text-[#2C1E16]" />
        <h2 className="text-[#2C1E16] uppercase tracking-widest text-xs font-black leading-tight">
          Machine<br />usage
        </h2>
      </div>
      {items.map((item) => <MachineCell key={item.name} item={item} />)}
    </div>
  );
}
