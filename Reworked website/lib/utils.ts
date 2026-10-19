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

/** A piece of description text: plain, **bold**, or a URL shortened for the TV. */
export type DescSpan = { text: string; bold?: boolean; url?: boolean };
/** A block of a description: a paragraph (lines kept apart) or a bullet list. */
export type DescBlock = { kind: 'p' | 'ul'; lines: DescSpan[][] };

const URL_RE = /(https?:\/\/[^\s)]+)/;
const BULLET_RE = /^\s*(?:[-•*·–]|\d+[.)])\s+/;

/** "https://www.opendrone.be/products/x?ref=yt" -> "opendrone.be/products/x" (nobody can click on a TV). */
export function shortUrl(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/, '').replace(/[?#].*$/, '').replace(/\/$/, '');
}

function spans(line: string): DescSpan[] {
  const out: DescSpan[] = [];
  line.split(/\*\*(.+?)\*\*/).forEach((part, i) => {
    part.split(URL_RE).forEach((piece, j) => {
      if (!piece) return;
      if (j % 2) out.push({ text: shortUrl(piece), url: true });
      else out.push({ text: piece, bold: i % 2 === 1 || undefined });
    });
  });
  return out;
}

/** Split description text into paragraphs (blank line) and bullet lists ("- ", "• ", "1. "). */
export function parseDescription(text: string): DescBlock[] {
  const blocks: DescBlock[] = [];
  for (const chunk of text.replace(/\r\n?/g, '\n').split(/\n\s*\n/)) {
    let current: DescBlock | undefined;   // lines of the same kind within one chunk stay together
    for (const raw of chunk.split('\n')) {
      const line = raw.trim();
      if (!line) continue;
      const kind = BULLET_RE.test(line) ? 'ul' : 'p';
      const content = spans(line.replace(BULLET_RE, ''));
      if (current?.kind === kind) current.lines.push(content);
      else blocks.push(current = { kind, lines: [content] });
    }
  }
  return blocks;
}
