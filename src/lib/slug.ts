/** Lowercase slug for community page URLs ([a-z0-9_-]) */
export function slugify(raw: string, fallback = 'page'): string {
  const base = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base.length >= 2 ? base.slice(0, 48) : `${fallback}-${Date.now()}`.slice(0, 48);
}
