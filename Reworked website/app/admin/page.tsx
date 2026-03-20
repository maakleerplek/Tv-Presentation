import { checkAuth, logoutAction } from './actions';
import { getScreenData } from '@/lib/data';
import Link from 'next/link';
import { Calendar, Globe, Repeat, LogOut, LayoutDashboard } from 'lucide-react';
import type { CalendarEvent, NewsItem } from '@/lib/types';
import { LoginForm } from './login-form';
import { AddNewsForm } from './add-news-form';
import { DeleteNewsButton } from './delete-news-button';

export default async function AdminPage() {
  const isAuthenticated = await checkAuth();

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#F5F2EB] flex flex-col items-center justify-center p-4">
        <LoginForm />
      </div>
    );
  }

  const data = await getScreenData();

  if (!data) {
    return (
      <div className="min-h-screen bg-[#F5F2EB] p-8">
        <p className="text-red-600 font-bold">Failed to load data from backend.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F2EB] text-[#2C1E16] font-sans selection:bg-[#2C1E16] selection:text-[#F5F2EB]">
      {/* Header */}
      <header className="bg-[#2C1E16] text-[#F5F2EB] p-6 flex justify-between items-center sticky top-0 z-10 shadow-md">
        <div className="flex items-center gap-4">
          <LayoutDashboard className="w-6 h-6" />
          <h1 className="text-xl font-black uppercase tracking-widest">Maakleerplek Admin</h1>
        </div>
        <div className="flex items-center gap-6">
          <Link href="/" className="text-sm font-bold uppercase hover:underline">
            View Presentation
          </Link>
          <form action={logoutAction}>
            <button type="submit" className="flex items-center gap-2 text-sm font-bold uppercase bg-[#F5F2EB] text-[#2C1E16] px-4 py-2 hover:bg-[#E5E0D8] transition-colors">
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </form>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-8 flex flex-col gap-12">
        {/* Custom News Integration Section */}
        <section>
           <AddNewsForm />
        </section>

        {/* News Section */}
        <section>
          <div className="flex items-center justify-between border-b-4 border-[#2C1E16] pb-2 mb-6">
            <h2 className="text-2xl font-black uppercase tracking-widest flex items-center gap-3">
              <Globe className="w-6 h-6" /> News & Stories
            </h2>
            <div className="bg-[#BBF7D0] border-2 border-[#2C1E16] px-3 py-1 text-xs font-black uppercase">
              {data.news.length} Items
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {data.news.map((item, idx) => (
              <NewsCard key={idx} item={item} />
            ))}
          </div>
        </section>

        {/* Workshops Section */}
        <section>
          <div className="flex items-center justify-between border-b-4 border-[#2C1E16] pb-2 mb-6">
            <h2 className="text-2xl font-black uppercase tracking-widest flex items-center gap-3">
              <Calendar className="w-6 h-6" /> Workshops
            </h2>
            <div className="bg-[#FEF08A] border-2 border-[#2C1E16] px-3 py-1 text-xs font-black uppercase">
              {data.workshops.length} Items
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {data.workshops.map((item, idx) => (
              <EventCard key={idx} item={item} color="#FEF08A" />
            ))}
          </div>
        </section>

        {/* Recurring Events Section */}
        <section>
          <div className="flex items-center justify-between border-b-4 border-[#2C1E16] pb-2 mb-6">
            <h2 className="text-2xl font-black uppercase tracking-widest flex items-center gap-3">
              <Repeat className="w-6 h-6" /> Recurring Events
            </h2>
            <div className="bg-[#BFDBFE] border-2 border-[#2C1E16] px-3 py-1 text-xs font-black uppercase">
              {data.recurringEvents.length} Items
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {data.recurringEvents.map((item, idx) => (
              <EventCard key={idx} item={item} color="#BFDBFE" />
            ))}
          </div>
        </section>

      </main>
    </div>
  );
}

// Sub-components for Cards
function NewsCard({ item }: { item: NewsItem }) {
  const isCustom = item._id !== undefined;

  return (
    <div className="bg-white border-2 border-[#2C1E16] flex flex-col h-full shadow-[4px_4px_0_0_#2C1E16] relative">
      {isCustom && <DeleteNewsButton id={item._id!} />}
      {item.imageUrl && (
        <div className="h-40 border-b-2 border-[#2C1E16] bg-[#E5E0D8] overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        </div>
      )}
      <div className="p-4 flex flex-col flex-1">
        <div className="flex justify-between items-start mb-2">
          <div className="text-[10px] font-black uppercase tracking-widest bg-[#BBF7D0] border-2 border-[#2C1E16] inline-block px-2 py-0.5 self-start">
            {item.date || 'Recent'}
          </div>
          {isCustom && (
            <div className="text-[10px] font-black uppercase tracking-widest bg-[#FEF08A] border-2 border-[#2C1E16] inline-block px-2 py-0.5 ml-2">
              Custom
            </div>
          )}
        </div>
        <h3 className={`font-black text-lg leading-tight mb-2 line-clamp-2 ${isCustom ? 'pr-8' : ''}`} title={item.title}>{item.title}</h3>
        <p className="text-sm opacity-80 line-clamp-3 mb-4 flex-1" title={item.description}>{item.description}</p>
        {item.link && (
            <a href={item.link} target="_blank" rel="noreferrer" className="text-xs font-bold uppercase underline hover:text-[#C8A98B] mt-auto">
              Source Link &rarr;
            </a>
        )}
      </div>
    </div>
  );
}

function EventCard({ item, color }: { item: CalendarEvent, color: string }) {
  return (
    <div className="bg-white border-2 border-[#2C1E16] flex flex-col h-full shadow-[4px_4px_0_0_#2C1E16]">
      {item.imageUrl && (
        <div className="h-40 border-b-2 border-[#2C1E16] bg-[#2C1E16] overflow-hidden flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.imageUrl.startsWith('/') ? `https://maakleerplek.be${item.imageUrl}` : item.imageUrl} alt={item.title} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
        </div>
      )}
      <div className="p-4 flex flex-col flex-1">
        <div className="flex gap-2 flex-wrap mb-3">
          <div className="text-[10px] font-black uppercase tracking-widest border-2 border-[#2C1E16] px-2 py-0.5 inline-block" style={{ backgroundColor: color }}>
            {item.date}
          </div>
          {item.time && (
            <div className="text-[10px] font-black uppercase tracking-widest bg-[#F5F2EB] border-2 border-[#2C1E16] px-2 py-0.5 inline-block">
              {item.time}
            </div>
          )}
          {item.price && (
            <div className="text-[10px] font-black uppercase tracking-widest bg-white border-2 border-[#2C1E16] px-2 py-0.5 inline-block">
              {item.price}
            </div>
          )}
        </div>
        <h3 className="font-black text-lg leading-tight mb-2 line-clamp-2" title={item.title}>{item.title}</h3>
        <div className="text-xs font-bold mb-2 flex items-center gap-1">
           📍 {item.location || 'maakleerplek'}
        </div>
        <p className="text-sm opacity-80 line-clamp-3 mb-4 flex-1" title={item.description}>{item.description}</p>
        <a href={item.link} target="_blank" rel="noreferrer" className="text-xs font-bold uppercase underline hover:text-[#C8A98B] mt-auto">
          Event Page &rarr;
        </a>
      </div>
    </div>
  );
}
