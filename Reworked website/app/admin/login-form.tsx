'use client';

import { useActionState } from 'react';
import { loginAction } from './actions';
import Link from 'next/link';

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(loginAction, null);

  return (
    <div className="bg-white p-8 border-2 border-[#2C1E16] shadow-[8px_8px_0_0_#2C1E16] max-w-sm w-full">
      <h1 className="text-2xl font-black uppercase tracking-widest text-[#2C1E16] mb-6 text-center">
        Admin Login
      </h1>
      <form action={formAction} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold uppercase tracking-widest text-[#2C1E16]">
            Password
          </label>
          <input 
            type="password" 
            name="password"
            required
            className="border-2 border-[#2C1E16] p-2 bg-[#F5F2EB] focus:outline-none focus:ring-2 focus:ring-[#C8A98B] font-mono"
          />
        </div>
        {state?.error && (
          <p className="text-red-600 text-xs font-bold uppercase">{state.error}</p>
        )}
        <button 
          type="submit"
          disabled={isPending}
          className="mt-4 bg-[#2C1E16] text-[#F5F2EB] font-black uppercase tracking-widest py-3 hover:bg-[#4A3326] transition-colors disabled:opacity-50"
        >
          {isPending ? 'Checking...' : 'Enter'}
        </button>
      </form>
      <div className="mt-6 text-center">
         <Link href="/" className="text-xs font-bold uppercase tracking-widest text-[#2C1E16] underline hover:text-[#C8A98B]">
           &larr; Back to Presentation
         </Link>
      </div>
    </div>
  );
}
