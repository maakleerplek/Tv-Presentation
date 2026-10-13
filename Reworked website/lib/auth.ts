import { createHash, randomBytes, timingSafeEqual } from 'crypto';

/**
 * Admin sign-in. The password comes from ADMIN_PASSWORD in .env; unset means
 * nobody can sign in. A login hands out a random token that lives in memory,
 * so a restart signs everyone out and a cookie can't be made up by hand.
 */
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const sessions = new Map<string, number>(); // token -> expiry (ms)

const digest = (s: string) => createHash('sha256').update(s).digest();

export function passwordMatches(password: string, expected = process.env.ADMIN_PASSWORD): boolean {
  if (!expected || !password) return false;
  return timingSafeEqual(digest(password), digest(expected));
}

export function createSession(now = Date.now()): string {
  const token = randomBytes(32).toString('hex');
  sessions.set(token, now + SESSION_MS);
  return token;
}

export function sessionValid(token: string | undefined, now = Date.now()): boolean {
  if (!token) return false;
  const expiry = sessions.get(token);
  if (!expiry) return false;
  if (expiry < now) {
    sessions.delete(token);
    return false;
  }
  return true;
}

export function endSession(token: string | undefined) {
  if (token) sessions.delete(token);
}

export const SESSION_MAX_AGE_S = SESSION_MS / 1000;
