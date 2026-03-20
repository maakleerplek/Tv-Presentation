'use client';

import { useTransition } from 'react';
import { deleteNewsAction } from './actions';
import { Trash2 } from 'lucide-react';

export function DeleteNewsButton({ id }: { id: number }) {
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    if (confirm('Are you sure you want to delete this custom news item?')) {
      startTransition(() => {
        deleteNewsAction(id);
      });
    }
  };

  return (
    <button 
      onClick={handleDelete}
      disabled={isPending}
      className="absolute top-2 right-2 bg-red-600 text-white p-2 border-2 border-[#2C1E16] hover:bg-red-700 disabled:opacity-50 z-10"
      title="Delete Custom News"
    >
      <Trash2 className="w-4 h-4" />
    </button>
  );
}
