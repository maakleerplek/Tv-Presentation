import Link from 'next/link';
import { LogOut } from 'lucide-react';
import { checkAuth, logoutAction } from './actions';
import { LoginForm } from './login-form';
import { NewsEditor } from './news-editor';
import { CategoryOrderEditor } from './category-order-editor';
import { TvOverview } from './tv-overview';
import { getCategoryOrder, getCustomNews } from '@/lib/db';
import { getScreenData } from '@/lib/data';

export const dynamic = 'force-dynamic';

// Shopping items, prices and stock on the TV come from here.
const STOCK_APP_URL = process.env.STOCK_APP_URL || 'https://stock.int.maakleerplek.be/';

export default async function AdminPage() {
  if (!(await checkAuth())) {
    return (
      <div className="min-h-screen bg-[#F5F2EB] flex items-center justify-center p-4">
        <LoginForm />
      </div>
    );
  }

  const order = getCategoryOrder();
  return (
    <div className="min-h-screen bg-[#F5F2EB] text-[#2C1E16]">
      <header className="bg-[#2C1E16] text-[#F5F2EB] px-6 py-4 flex justify-between items-center">
        <h1 className="text-lg font-black uppercase tracking-widest">TV admin</h1>
        <div className="flex items-center gap-6">
          <a href={STOCK_APP_URL} target="_blank" rel="noreferrer" className="text-sm font-bold uppercase hover:underline">Stock system</a>
          <Link href="/" className="text-sm font-bold uppercase hover:underline">Back to TV</Link>
          <form action={logoutAction}>
            <button type="submit" className="flex items-center gap-2 text-sm font-bold uppercase bg-[#F5F2EB] text-[#2C1E16] px-3 py-1.5">
              <LogOut className="w-4 h-4" /> Sign out
            </button>
          </form>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 flex flex-col gap-12">
        <div className="grid gap-10 lg:grid-cols-[1fr_20rem]">
          <section>
            <h2 className="text-xl font-black uppercase tracking-widest mb-4">Your news items</h2>
            <NewsEditor items={getCustomNews()} />
          </section>
          <section>
            <h2 className="text-xl font-black uppercase tracking-widest mb-4">Category order</h2>
            <CategoryOrderEditor saved={order} />
          </section>
        </div>
        <section>
          <h2 className="text-xl font-black uppercase tracking-widest mb-4">On the TV now</h2>
          <TvOverview data={await getScreenData()} order={order} stockAppUrl={STOCK_APP_URL} />
        </section>
      </main>
    </div>
  );
}
