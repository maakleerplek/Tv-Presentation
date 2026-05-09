import { checkAuth } from '../actions';
import { AnimationTester } from './animation-tester';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { redirect } from 'next/navigation';

export default async function AnimationsPage() {
  const isAuthenticated = await checkAuth();
  if (!isAuthenticated) redirect('/admin');

  return (
    <div className="min-h-screen bg-[#F5F2EB] text-[#2C1E16]">
      <header className="bg-[#2C1E16] text-[#F5F2EB] p-6 flex items-center gap-6 sticky top-0 z-10 shadow-md">
        <Link href="/admin" className="flex items-center gap-2 text-sm font-bold uppercase hover:underline">
          <ArrowLeft className="w-4 h-4" /> Admin
        </Link>
        <h1 className="text-xl font-black uppercase tracking-widest">Animation Tester</h1>
      </header>
      <main className="max-w-3xl mx-auto p-8">
        <AnimationTester />
      </main>
    </div>
  );
}
