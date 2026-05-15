import { Clock } from "@/components/clock";
import { Weather } from "@/components/weather";
import { EventCarousel } from "@/components/event-carousel";
import { DrinksList } from "@/components/drinks-list";
import { TipsFooter } from "@/components/tips-footer";
import { Status } from "@/components/status";
import { AdminHoverBar } from "@/components/admin-hover-bar";
import { getScreenData, getWeatherData } from "@/lib/data";

export default async function Page() {
  const screenData = await getScreenData();
  const weatherData = await getWeatherData();

  return (
    <div className="h-screen w-screen bg-[#F5F2EB] text-[#2C1E16] overflow-hidden flex flex-col font-sans selection:bg-[#2C1E16] selection:text-[#F5F2EB] relative">
      <AdminHoverBar />
      <main className="flex-1 grid grid-cols-12 min-h-0">
        {/* Left Section - 2/12 (~16%) */}
        <aside className="col-span-2 border-r-2 border-[#2C1E16] flex flex-col h-full">
          <Clock initialData={screenData || undefined} />
          <Weather initialData={weatherData || undefined} />
          <Status initialData={screenData || undefined} />
        </aside>

        {/* Middle Section - 4/12 (~33%) */}
        <section className="col-span-4 border-r-2 border-[#2C1E16] flex flex-col h-full bg-[#F5F2EB]">
          <EventCarousel initialData={screenData || undefined} />
        </section>

        {/* Right Section - 6/12 (~50%) */}
        <aside className="col-span-6 flex flex-col h-full bg-[#F5F2EB]">
          <DrinksList initialData={screenData || undefined} />
        </aside>
      </main>

      {/* Bottom Section - 80px fixed height */}
      <footer className="h-[80px] shrink-0 bg-[#F5F2EB] relative">
        <TipsFooter initialData={screenData || undefined} />
      </footer>
    </div>
  );
}
