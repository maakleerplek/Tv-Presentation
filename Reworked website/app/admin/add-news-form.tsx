'use client';

import { useActionState, useRef } from 'react';
import { createNewsAction } from './actions';

export function AddNewsForm() {
  const [state, formAction, isPending] = useActionState(createNewsAction, null);
  const formRef = useRef<HTMLFormElement>(null);

  // If successful, reset the form. Next.js server actions do not auto-reset forms on success.
  if (state?.success && formRef.current) {
    formRef.current.reset();
  }

  return (
    <form ref={formRef} action={formAction} className="bg-white p-6 border-2 border-[#2C1E16] shadow-[4px_4px_0_0_#2C1E16] flex flex-col gap-4">
      <h3 className="text-xl font-black uppercase tracking-widest text-[#2C1E16] mb-2 border-b-2 border-[#2C1E16] pb-2">
        Create Custom News Item
      </h3>
      
      {state?.error && (
        <div className="bg-red-100 border-2 border-red-500 text-red-700 p-2 text-sm font-bold uppercase">
          {state.error}
        </div>
      )}

      {state?.success && (
        <div className="bg-green-100 border-2 border-green-500 text-green-700 p-2 text-sm font-bold uppercase">
          News item added successfully!
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label className="text-xs font-bold uppercase tracking-widest text-[#2C1E16]">Title *</label>
        <input name="title" required className="border-2 border-[#2C1E16] p-2 bg-[#F5F2EB] focus:outline-none focus:ring-2 focus:ring-[#C8A98B]" />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-bold uppercase tracking-widest text-[#2C1E16]">Description *</label>
        <textarea name="description" required rows={3} className="border-2 border-[#2C1E16] p-2 bg-[#F5F2EB] focus:outline-none focus:ring-2 focus:ring-[#C8A98B]" />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-bold uppercase tracking-widest text-[#2C1E16]">URL for QR Code (Optional)</label>
        <input name="url" type="url" className="border-2 border-[#2C1E16] p-2 bg-[#F5F2EB] focus:outline-none focus:ring-2 focus:ring-[#C8A98B]" placeholder="https://..." />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-bold uppercase tracking-widest text-[#2C1E16]">Image URL (Optional)</label>
        <input name="imageUrl" type="url" className="border-2 border-[#2C1E16] p-2 bg-[#F5F2EB] focus:outline-none focus:ring-2 focus:ring-[#C8A98B]" placeholder="https://..." />
        <p className="text-[10px] text-[#2C1E16] opacity-70">Best to use 16x9 aspect ratio.</p>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-bold uppercase tracking-widest text-[#2C1E16]">Tags (Optional, comma separated)</label>
        <input name="tags" className="border-2 border-[#2C1E16] p-2 bg-[#F5F2EB] focus:outline-none focus:ring-2 focus:ring-[#C8A98B]" placeholder="e.g. Workshop, Event" />
      </div>

      <button 
        type="submit" 
        disabled={isPending}
        className="mt-4 bg-[#2C1E16] text-[#F5F2EB] font-black uppercase tracking-widest py-3 hover:bg-[#4A3326] transition-colors disabled:opacity-50"
      >
        {isPending ? 'Adding...' : 'Add News Item'}
      </button>
    </form>
  );
}
