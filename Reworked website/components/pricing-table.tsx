'use client';

import { Tag, Zap, Box, GraduationCap } from 'lucide-react';
import { useScreenData } from '@/hooks/useScreenData';

const PricingSection = ({ title, icon: Icon, items, color }: { title: string, icon: any, items: { name: string, price: string }[], color: string }) => (
  <div className="flex flex-col min-w-0">
    <div className={`px-2 py-1 border-b-2 border-[#2C1E16] flex items-center gap-1.5 ${color}`}>
      <Icon className="w-3 h-3 text-[#2C1E16] shrink-0" />
      <h3 className="text-[9px] font-black uppercase tracking-wider text-[#2C1E16] truncate">{title}</h3>
    </div>
    <div className="flex flex-col">
      {items.length > 0 ? (
        items.map((item, idx) => (
          <div key={idx} className="grid grid-cols-[1fr_auto] gap-1 px-2 py-1.5 border-b border-[#2C1E16]/20 last:border-b-0">
            <span className="text-[10px] font-bold uppercase truncate text-[#2C1E16]">{item.name}</span>
            <span className="text-[10px] font-black text-[#2C1E16] shrink-0">{item.price}</span>
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

  const memberships = data?.pricing?.memberships || [
    { name: 'Basic (20% korting)', price: '€25/m' },
    { name: 'Maker (+10u incl)', price: '€50/m' },
    { name: 'Pro (Onbeperkt)', price: '€100/m' },
  ];

  const equipment = data?.pricing?.equipment || [
    { name: 'FDM 3D Printer', price: '€0.50/u' },
    { name: 'Resin 3D Printer', price: '€2.00/u' },
    { name: 'CO2 Laser Cutter', price: '€1.50/u' },
    { name: 'CNC Mill/Router', price: '€3.00/u' },
    { name: 'Vacuum Former', price: '€1.00/u' },
  ];

  const materials = data?.pricing?.materials || [
    { name: 'PLA (1kg)', price: '€20' },
    { name: 'PETG (1kg)', price: '€25' },
    { name: 'Resin (1L)', price: '€60' },
    { name: 'Acrylic (A4)', price: '€3' },
    { name: 'Plywood (A4)', price: '€1.50' },
  ];

  const workshops = data?.pricing?.workshops || [
    { name: 'Laser Certificatie', price: '€10' },
    { name: 'Intro 3D Printing', price: '€15' },
    { name: 'CNC Workshop', price: '€25' },
  ];

  return (
    <div className="bg-[#F5F2EB] flex flex-col border-t-2 border-[#2C1E16] shrink-0">
      <div className="p-3 border-b-2 border-[#2C1E16] bg-[#A7C7E7]">
        <h2 className="text-[#2C1E16] uppercase tracking-widest text-[10px] font-black flex items-center gap-2">
          <Tag className="w-3.5 h-3.5" /> HTL Tarieven
        </h2>
      </div>
      
      <div className="grid grid-cols-4 divide-x-2 divide-[#2C1E16]">
        <PricingSection 
          title="Memberships" 
          icon={Zap} 
          items={memberships} 
          color="bg-[#FEF08A]" 
        />
        <PricingSection 
          title="Machines" 
          icon={Box} 
          items={equipment} 
          color="bg-[#FCA5A5]" 
        />
        <PricingSection 
          title="Materialen" 
          icon={Tag} 
          items={materials} 
          color="bg-[#BAE6FD]" 
        />
        <PricingSection 
          title="Workshops" 
          icon={GraduationCap} 
          items={workshops} 
          color="bg-[#BBF7D0]" 
        />
      </div>
    </div>
  );
}
