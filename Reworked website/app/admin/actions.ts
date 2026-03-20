'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { addCustomNews, deleteCustomNews, verifyAdmin } from '@/lib/db';

const COOKIE_NAME = 'admin_session';

export async function loginAction(prevState: any, formData: FormData) {
  const password = formData.get('password') as string;

  if (verifyAdmin(password)) {
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, 'authenticated', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 1 week
    });
    redirect('/admin');
  } else {
    return { error: 'Incorrect password' };
  }
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
  redirect('/admin');
}

export async function checkAuth() {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value === 'authenticated';
}

export async function createNewsAction(prevState: any, formData: FormData) {
  const isAuth = await checkAuth();
  if (!isAuth) return { error: 'Unauthorized' };

  const title = formData.get('title') as string;
  const description = formData.get('description') as string;
  const url = formData.get('url') as string;
  const imageUrl = formData.get('imageUrl') as string;
  const tags = formData.get('tags') as string;

  if (!title || !description) {
    return { error: 'Title and description are required' };
  }

  try {
    addCustomNews(title, description, url || '', imageUrl || '', tags || '');
    revalidatePath('/admin');
    revalidatePath('/');
    return { success: true };
  } catch (e: any) {
    return { error: 'Failed to add news item: ' + e.message };
  }
}

export async function deleteNewsAction(id: number) {
  const isAuth = await checkAuth();
  if (!isAuth) throw new Error('Unauthorized');

  deleteCustomNews(id);
  revalidatePath('/admin');
  revalidatePath('/');
}
