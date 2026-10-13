'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { addCustomNews, updateCustomNews, deleteCustomNews, setCategoryOrder } from '@/lib/db';
import { sanitizeCategoryOrder } from '@/lib/category-order';
import { passwordMatches, createSession, sessionValid, endSession, SESSION_MAX_AGE_S } from '@/lib/auth';

const COOKIE_NAME = 'admin_session';

export type FormState = { error?: string; success?: boolean } | null;

export async function checkAuth() {
  return sessionValid((await cookies()).get(COOKIE_NAME)?.value);
}

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!process.env.ADMIN_PASSWORD) return { error: 'ADMIN_PASSWORD is not set on the server' };
  if (!passwordMatches(String(formData.get('password') ?? ''))) return { error: 'Incorrect password' };

  // The TV runs on plain http: a Secure cookie would be dropped by the browser,
  // which signed you out again on the very next action.
  const https = (await headers()).get('x-forwarded-proto') === 'https';
  (await cookies()).set(COOKIE_NAME, createSession(), {
    httpOnly: true,
    secure: https,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_S,
  });
  redirect('/admin');
}

export async function logoutAction() {
  const store = await cookies();
  endSession(store.get(COOKIE_NAME)?.value);
  store.delete(COOKIE_NAME);
  redirect('/admin');
}

/** "maakleerplek.be/x" -> "https://maakleerplek.be/x"; empty stays empty. */
function normalizeUrl(value: FormDataEntryValue | null): string {
  const s = String(value ?? '').trim();
  if (!s) return '';
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}

/** Add a news item, or update it when the form carries an id. */
export async function saveNewsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await checkAuth())) return { error: 'Signed out, sign in again' };

  const title = String(formData.get('title') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  if (!title || !description) return { error: 'Title and description are required' };

  const fields = {
    title,
    description,
    url: normalizeUrl(formData.get('url')),
    imageUrl: normalizeUrl(formData.get('imageUrl')),
    tags: String(formData.get('tags') ?? '').trim(),
  };
  const id = Number(formData.get('id'));
  if (id) updateCustomNews(id, fields);
  else addCustomNews(fields.title, fields.description, fields.url, fields.imageUrl, fields.tags);

  revalidatePath('/admin');
  revalidatePath('/');
  return { success: true };
}

export async function deleteNewsAction(id: number): Promise<FormState> {
  if (!(await checkAuth())) return { error: 'Signed out, sign in again' };
  deleteCustomNews(id);
  revalidatePath('/admin');
  revalidatePath('/');
  return { success: true };
}

export async function saveCategoryOrderAction(order: string[]): Promise<FormState> {
  if (!(await checkAuth())) return { error: 'Signed out, sign in again' };
  const clean = sanitizeCategoryOrder(order);
  if (!clean) return { error: 'Invalid category list' };
  setCategoryOrder(clean);
  revalidatePath('/admin');
  return { success: true };
}
