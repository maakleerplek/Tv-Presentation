/**
 * Order of the inventory categories on the TV. The admin panel stores it in the
 * settings table; this default applies until someone saves an order there.
 * Names are InvenTree category names and match case-insensitively.
 */
export const DEFAULT_CATEGORY_ORDER = ['Drinks', 'Wood', 'Filament', 'Per gewicht'];

/** Position in the order; categories not in it come after all listed ones. */
export function categoryRank(order: string[], category: string | null): number {
  const i = order.findIndex(c => c.toLowerCase() === (category ?? '').toLowerCase());
  return i === -1 ? order.length : i;
}

/**
 * The list the admin panel edits: the saved order first, then categories that
 * exist in InvenTree but aren't in it yet, alphabetically. Saved names that no
 * longer exist stay, so a category that is temporarily out of stock keeps its place.
 */
export function mergeCategoryOrder(saved: string[], present: string[]): string[] {
  const known = new Set(saved.map(c => c.toLowerCase()));
  const extra = [...new Set(present)]
    .filter(c => !known.has(c.toLowerCase()))
    .sort((a, b) => a.localeCompare(b));
  return [...saved, ...extra];
}

/** Accept only a list of non-empty strings, trimmed and without duplicates. */
export function sanitizeCategoryOrder(value: unknown): string[] | null {
  if (!Array.isArray(value) || !value.every(v => typeof v === 'string')) return null;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of value as string[]) {
    const name = raw.trim();
    if (name && !seen.has(name.toLowerCase())) {
      seen.add(name.toLowerCase());
      out.push(name);
    }
  }
  return out;
}
