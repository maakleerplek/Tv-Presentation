'use client';

import Link from 'next/link';
import { Clock } from '@/components/clock';
import { Weather } from '@/components/weather';
import { EventCarousel } from '@/components/event-carousel';
import { DrinksList } from '@/components/drinks-list';
import { TipsFooter } from '@/components/tips-footer';
import { Status } from '@/components/status';
import { ScreenDataOverrideProvider } from '@/hooks/useScreenData';
import type { ScreenData } from '@/lib/types';
import type { WeatherData } from '@/app/api/weather/route';

export function PreviewLayout({
  screenData,
  weatherData,
}: {
  screenData: ScreenData | null;
  weatherData: WeatherData | null;
}) {
  if (!screenData) {
    return (
      <div className="h-screen w-screen bg-[#F5F2EB] flex items-center justify-center">
        <p className="font-black uppercase tracking-widest text-[#2C1E16] opacity-40">
          No data available — is the data-fetcher running?
        </p>
      </div>
    );
  }

  return (
    <ScreenDataOverrideProvider data={screenData}>
      {/* Floating badge */}
      <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-[#2C1E16] text-[#F5F2EB] px-4 py-1.5 border-2 border-[#C8A98B] shadow-lg">
        <span className="text-[10px] font-black uppercase tracking-widest">Preview — 2s transitions</span>
        <Link
          href="/admin"
          className="text-[10px] font-black uppercase tracking-widest underline hover:text-[#C8A98B]"
        >
          ← Admin
        </Link>
      </div>

      {/* Identical layout to the main page */}
      <div className="h-screen w-screen bg-[#F5F2EB] text-[#2C1E16] overflow-hidden flex flex-col font-sans relative">
        <main className="flex-1 grid grid-cols-12 border-b-2 border-[#2C1E16] min-h-0">
          <aside className="col-span-2 border-r-2 border-[#2C1E16] flex flex-col h-full">
            <Clock initialData={screenData} />
            <Weather initialData={weatherData || undefined} />
            <Status initialData={screenData} />
          </aside>

          <section className="col-span-4 border-r-2 border-[#2C1E16] flex flex-col h-full bg-[#F5F2EB]">
            <EventCarousel initialData={screenData} />
          </section>

          <aside className="col-span-6 flex flex-col h-full bg-[#F5F2EB]">
            <DrinksList initialData={screenData} />
          </aside>
        </main>

        <footer className="h-[80px] shrink-0 bg-[#F5F2EB] relative">
          <TipsFooter initialData={screenData} />
        </footer>
      </div>
    </ScreenDataOverrideProvider>
  );
}
