/* eslint-disable @next/next/no-img-element -- thumbnails from several hosts, admin only */
import type { CalendarEvent, DrinkItem, NewsItem, ScreenData } from '@/lib/types';

const box = 'bg-white border-2 border-[#2C1E16]';
const badge = 'text-[10px] font-black uppercase tracking-widest border-2 border-[#2C1E16] px-1.5 py-0.5';

const eventImage = (src: string) => (src.startsWith('/') ? `https://maakleerplek.be${src}` : src);

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="flex items-center gap-3 font-black uppercase tracking-widest border-b-4 border-[#2C1E16] pb-1 mb-3">
        {title} <span className={`${badge} bg-[#F5F2EB]`}>{count}</span>
      </h3>
      {count === 0 ? <p className="text-sm opacity-70">Nothing right now.</p> : children}
    </section>
  );
}

function EventRow({ e }: { e: CalendarEvent }) {
  return (
    <li className={`${box} flex gap-3 p-2`}>
      {e.imageUrl
        ? <img src={eventImage(e.imageUrl)} alt="" className="w-24 aspect-video object-cover border-2 border-[#2C1E16] shrink-0" />
        : <div className="w-24 aspect-video bg-[#E5E0D8] border-2 border-[#2C1E16] shrink-0" />}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap gap-1 mb-1">
          <span className={`${badge} bg-[#FEF08A]`}>{e.date}</span>
          {e.time && <span className={badge}>{e.time}</span>}
          {e.price && <span className={badge}>{e.price}</span>}
        </div>
        <a href={e.link} target="_blank" rel="noreferrer" className="font-black leading-tight hover:underline line-clamp-1">{e.title}</a>
        <p className="text-xs opacity-70 line-clamp-1">{e.location}</p>
      </div>
    </li>
  );
}

function NewsRow({ n }: { n: NewsItem }) {
  return (
    <li className={`${box} flex gap-3 p-2`}>
      {n.imageUrl && <img src={n.imageUrl} alt="" className="w-24 aspect-video object-cover border-2 border-[#2C1E16] shrink-0" />}
      <div className="min-w-0 flex-1">
        <div className="flex gap-1 mb-1">
          {n.date && <span className={`${badge} bg-[#BBF7D0]`}>{n.date}</span>}
          {n._id !== undefined && <span className={`${badge} bg-[#C8A98B]`}>Yours</span>}
        </div>
        {n.link
          ? <a href={n.link} target="_blank" rel="noreferrer" className="font-black leading-tight hover:underline line-clamp-1">{n.title}</a>
          : <p className="font-black leading-tight line-clamp-1">{n.title}</p>}
        <p className="text-xs opacity-70 line-clamp-1">{n.description}</p>
      </div>
    </li>
  );
}

/** Shopping items grouped by category, in the order the TV shows them. */
function ShopItems({ drinks, order }: { drinks: DrinkItem[]; order: string[] }) {
  const groups = new Map<string, DrinkItem[]>();
  for (const d of drinks) {
    const cat = d.category ?? 'Other';
    groups.set(cat, [...(groups.get(cat) ?? []), d]);
  }
  const rank = (c: string) => {
    const i = order.findIndex(o => o.toLowerCase() === c.toLowerCase());
    return i === -1 ? order.length : i;
  };
  const cats = [...groups.keys()].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {cats.map(cat => (
        <div key={cat} className={box}>
          <p className="font-black uppercase tracking-widest text-sm bg-[#2C1E16] text-[#F5F2EB] px-3 py-1">{cat}</p>
          <table className="w-full text-sm">
            <tbody>
              {groups.get(cat)!.map(d => (
                <tr key={`${d.name}-${d.location}`} className="border-t border-[#2C1E16]/20">
                  <td className="px-3 py-1.5 font-bold">{d.name}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{d.price}</td>
                  <td className={`px-3 py-1.5 text-right tabular-nums ${d.stock <= 0 ? 'text-red-700 font-black' : ''}`}>
                    {d.stock} in stock
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

/** Read-only view of what the TV shows: the website's events and news, and the shop. */
export function TvOverview({ data, order, stockAppUrl }: { data: ScreenData | null; order: string[]; stockAppUrl: string }) {
  if (!data) {
    return <p className={`${box} p-4 font-bold text-red-700`}>Could not reach the data-fetcher, so the TV content can&apos;t be shown.</p>;
  }
  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-8 lg:grid-cols-2">
        <Section title="Workshops" count={data.workshops.length}>
          <ul className="flex flex-col gap-2">{data.workshops.map(e => <EventRow key={e.link + e.dateISO} e={e} />)}</ul>
        </Section>
        <Section title="Recurring events" count={data.recurringEvents.length}>
          <ul className="flex flex-col gap-2">{data.recurringEvents.map(e => <EventRow key={e.link + e.dateISO} e={e} />)}</ul>
        </Section>
      </div>
      <Section title="News" count={data.news.length}>
        <ul className="grid gap-2 lg:grid-cols-2">{data.news.map((n, i) => <NewsRow key={n._id ?? n.link ?? i} n={n} />)}</ul>
      </Section>
      <Section title="Shopping items" count={data.drinks.length}>
        <p className="text-sm mb-3">
          Items, prices and stock come from the stock system. Change them there:{' '}
          <a href={stockAppUrl} target="_blank" rel="noreferrer" className="font-black underline">{stockAppUrl.replace(/^https?:\/\//, '')}</a>
        </p>
        <ShopItems drinks={data.drinks} order={order} />
      </Section>
    </div>
  );
}
