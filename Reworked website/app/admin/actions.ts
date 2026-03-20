'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const ADMIN_PASSWORD = '3EmmertjesWater';
const COOKIE_NAME = 'admin_session';

export async function loginAction(prevState: any, formData: FormData) {
  const password = formData.get('password');

  if (password === ADMIN_PASSWORD) {
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
