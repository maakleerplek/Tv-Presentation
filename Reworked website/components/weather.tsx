import { CloudRain, Wind, Droplets } from 'lucide-react';

export function Weather() {
  return (
    <div className="border-b-2 border-[#2C1E16] p-4 bg-[#E6D5B8] flex-1 flex flex-col justify-center">
      <h2 className="text-[#2C1E16] uppercase tracking-widest text-[10px] font-black mb-3">Weather</h2>
      <div className="flex items-center gap-3 mb-4">
        <CloudRain className="w-10 h-10 text-[#2C1E16] shrink-0" />
        <div>
          <div className="text-4xl font-black text-[#2C1E16] leading-none">14°C</div>
          <div className="text-[#2C1E16] text-xs font-black mt-1 uppercase leading-none">Light Rain</div>
        </div>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-2 text-xs font-black">
        <div className="flex items-center gap-2 text-[#2C1E16]">
          <Wind className="w-4 h-4 shrink-0" />
          <span>12 km/h</span>
        </div>
        <div className="flex items-center gap-2 text-[#2C1E16]">
          <Droplets className="w-4 h-4 shrink-0" />
          <span>84%</span>
        </div>
      </div>
    </div>
  );
}
