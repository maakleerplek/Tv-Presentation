'use client';

import { useActionState, useState, useTransition } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { saveNewsAction, deleteNewsAction, type FormState } from './actions';
import type { CustomNewsRow } from '@/lib/db';

const input = 'border-2 border-[#2C1E16] p-2 bg-[#F5F2EB] focus:outline-none focus:ring-2 focus:ring-[#C8A98B]';
const label = 'text-xs font-bold uppercase tracking-widest';

/** Your own news items: the list, and one form that adds or edits. */
export function NewsEditor({ items }: { items: CustomNewsRow[] }) {
  const [editing, setEditing] = useState<CustomNewsRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, startDelete] = useTransition();
  // A new key remounts the form, so it shows the item being edited (or empties after a save).
  const [formKey, setFormKey] = useState(0);
  const [state, formAction, saving] = useActionState(async (prev: FormState, data: FormData) => {
    const res = await saveNewsAction(prev, data);
    if (res?.success) edit(null);
    return res;
  }, null);

  function edit(item: CustomNewsRow | null) {
    setEditing(item);
    setFormKey(k => k + 1);
  }

  function remove(item: CustomNewsRow) {
    if (!confirm(`Delete "${item.title}"?`)) return;
    startDelete(async () => {
      const res = await deleteNewsAction(item.id);
      setDeleteError(res?.error ?? null);
      if (editing?.id === item.id) edit(null);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <form key={formKey} action={formAction}
        className="bg-white p-5 border-2 border-[#2C1E16] shadow-[4px_4px_0_0_#2C1E16] flex flex-col gap-3">
        <h3 className="font-black uppercase tracking-widest">{editing ? 'Edit item' : 'New item'}</h3>
        {state?.error && <p className="bg-red-100 border-2 border-red-500 text-red-700 p-2 text-sm font-bold">{state.error}</p>}
        {editing && <input type="hidden" name="id" value={editing.id} />}

        <label className="flex flex-col gap-1"><span className={label}>Title *</span>
          <input name="title" required defaultValue={editing?.title} className={input} /></label>
        <label className="flex flex-col gap-1"><span className={label}>Description *</span>
          <textarea name="description" required rows={3} defaultValue={editing?.description} className={input} /></label>
        <label className="flex flex-col gap-1"><span className={label}>Link for the QR code</span>
          <input name="url" defaultValue={editing?.url} placeholder="maakleerplek.be/..." className={input} /></label>
        <label className="flex flex-col gap-1"><span className={label}>Image URL (16:9 works best)</span>
          <input name="imageUrl" defaultValue={editing?.image_url ?? ''} placeholder="https://..." className={input} /></label>
        <label className="flex flex-col gap-1"><span className={label}>Tags, comma separated</span>
          <input name="tags" defaultValue={editing?.tags} placeholder="Workshop, Event" className={input} /></label>

        <div className="flex gap-3 mt-2">
          <button type="submit" disabled={saving}
            className="bg-[#2C1E16] text-[#F5F2EB] font-black uppercase tracking-widest px-5 py-2 disabled:opacity-50">
            {saving ? 'Saving...' : editing ? 'Save changes' : 'Add to TV'}
          </button>
          {editing && (
            <button type="button" onClick={() => edit(null)} className="border-2 border-[#2C1E16] px-4 py-2 font-bold uppercase text-sm">
              Cancel
            </button>
          )}
        </div>
      </form>

      {deleteError && <p className="bg-red-100 border-2 border-red-500 text-red-700 p-2 text-sm font-bold">{deleteError}</p>}
      {items.length === 0 ? (
        <p className="text-sm opacity-70">No news items of your own yet. The TV shows the website&apos;s news.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map(item => (
            <li key={item.id} className={`bg-white border-2 border-[#2C1E16] p-4 flex gap-4 items-start ${editing?.id === item.id ? 'ring-4 ring-[#C8A98B]' : ''}`}>
              {item.image_url && (
                // eslint-disable-next-line @next/next/no-img-element -- any host, and only an admin thumbnail
                <img src={item.image_url} alt="" className="w-28 aspect-video object-cover border-2 border-[#2C1E16]" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-black leading-tight">{item.title}</p>
                <p className="text-sm line-clamp-2 mt-1">{item.description}</p>
                {item.url && <p className="text-xs mt-1 truncate opacity-70">{item.url}</p>}
              </div>
              <button type="button" onClick={() => edit(item)} title="Edit" className="border-2 border-[#2C1E16] p-2">
                <Pencil className="w-4 h-4" />
              </button>
              <button type="button" onClick={() => remove(item)} disabled={deleting} title="Delete"
                className="border-2 border-[#2C1E16] p-2 bg-red-600 text-white disabled:opacity-50">
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
