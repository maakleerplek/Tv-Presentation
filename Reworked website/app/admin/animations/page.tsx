import { checkAuth } from '../actions';
import { LoginForm } from '../login-form';
import { AnimationTester } from './animation-tester';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default async function AnimationsPage() {
  const isAuthenticated = await checkAuth();

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#F5F2EB] flex flex-col items-center justify-center p-4">
        <LoginForm />
      </div>
    );
  }

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
