/** Shared "search bar that understands more than one field" helper for admin list pages
 * (Orders, Customers) — a free-text query can also be a date or a plain amount, not just a
 * substring match. */

/** A plain numeric query ("1750" or "1750.50") is read as an amount elsewhere — a day range is
 * only attempted for queries that aren't just a number, so a bare amount doesn't also misfire as
 * `new Date("1750")` (JS happily parses that as the year 1750). */
export function parseSearchDateRange(q: string): { gte: Date; lt: Date } | null {
  if (/^\d+(\.\d+)?$/.test(q)) return null;
  const parsed = new Date(q);
  if (Number.isNaN(parsed.getTime())) return null;
  const start = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { gte: start, lt: end };
}

/** A query that's just digits (optionally with up to 2 decimal places) — read as an exact amount. */
export function parseSearchAmount(q: string): number | null {
  return /^\d+(\.\d{1,2})?$/.test(q) ? Number(q) : null;
}
