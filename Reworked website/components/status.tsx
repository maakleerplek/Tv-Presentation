export function Status() {
  return (
    <div className="p-4 bg-[#F5F2EB] flex-1 flex flex-col justify-center min-h-0">
      <h2 className="text-[#2C1E16] uppercase tracking-widest text-[10px] font-black mb-3 shrink-0">Current Event</h2>
      <div className="flex items-center gap-2 text-[#2C1E16] mb-4 border-2 border-[#2C1E16] p-3 bg-[#86EFAC] shrink-0">
        <div className="w-4 h-4 bg-[#2C1E16] animate-pulse shrink-0" />
        <span className="font-black text-lg uppercase tracking-tight">OpenLab</span>
      </div>
      <div className="mt-auto shrink-0">
        <p className="text-[#2C1E16] text-[10px] uppercase tracking-widest font-black mb-1">Time</p>
        <p className="text-[#2C1E16] font-black text-base uppercase leading-tight">Thu 18:00 &rarr; 22:00</p>
      </div>
    </div>
  );
}
