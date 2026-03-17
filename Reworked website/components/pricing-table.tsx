'use client';

import { Tag, Zap, Box, GraduationCap } from 'lucide-react';
import { useScreenData } from '@/hooks/useScreenData';

const PricingSection = ({ title, icon: Icon, items, color }: { title: string, icon: any, items: { name: string, price: string }[], color: string }) => (
  <div className="flex flex-col min-w-0">
    <div className={`px-2 py-1 border-b-2 border-[#2C1E16] flex items-center justify-center gap-1.5 ${color}`}>
      <Icon className="w-3 h-3 text-[#2C1E16] shrink-0" />
      <h3 className="text-[9px] font-black uppercase tracking-wider text-[#2C1E16] truncate text-center">{title}</h3>
    </div>
    <div className="flex flex-col">
      {items.length > 0 ? (
        items.map((item, idx) => (
          <div key={idx} className="grid grid-cols-[1fr_auto] gap-1 px-2 py-1.5 border-b border-[#2C1E16]/20 last:border-b-0">
            <span className="text-[10px] font-bold uppercase truncate text-[#2C1E16] leading-none" title={item.name}>{item.name}</span>
            <span className="text-[10px] font-black text-[#2C1E16] shrink-0 leading-none">{item.price}</span>
          </div>
        ))
      ) : (
        <div className="px-2 py-1.5 text-[9px] uppercase font-bold text-[#2C1E16]/40 italic">Geen info</div>
      )}
    </div>
  </div>
);

export function PricingTable() {
  const { data } = useScreenData();

  const machineSection = { 
    title: "Machine Gebruik", 
    icon: Box, 
    items: data?.pricing?.equipment || [], 
    color: "bg-[#FCA5A5]" 
  };

  if (machineSection.items.length === 0) return null;

  return (
    <div className="bg-[#F5F2EB] flex flex-col border-t-2 border-[#2C1E16] shrink-0">
      <div className="p-3 border-b-2 border-[#2C1E16] bg-[#A7C7E7]">
        <h2 className="text-[#2C1E16] uppercase tracking-widest text-[10px] font-black flex items-center justify-center gap-2">
          <Tag className="w-3.5 h-3.5" /> HTL Tarieven
        </h2>
      </div>
      
      <PricingSection 
        title={machineSection.title} 
        icon={machineSection.icon} 
        items={machineSection.items} 
        color={machineSection.color} 
      />
    </div>
  );
}
