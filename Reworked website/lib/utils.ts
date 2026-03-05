import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Return the priority index of an event title given the ordered keyword list (lower = higher priority).
 *  Returns Infinity if no keyword matches. */
export function priorityOf(title: string, keywords: string[]): number {
  const lower = title.toLowerCase();
  for (let i = 0; i < keywords.length; i++) {
    if (lower.includes(keywords[i])) return i;
  }
  return Infinity;
}

/** Format a YYYY-MM-DD string as a Dutch short date, e.g. "do 5 mrt" */
export function formatDutchDate(dateISO: string): string {
  const parts = dateISO.split('-').map(Number);
  if (parts.length !== 3) return dateISO;
  const [y, m, d] = parts;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('nl-BE', { weekday: 'short', day: 'numeric', month: 'short' });
}
