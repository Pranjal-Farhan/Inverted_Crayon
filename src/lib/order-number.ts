/**
 * Human-facing order number. Not guaranteed unique on its own (Order.number
 * is `@unique` in the schema) — callers must retry with a fresh number on a
 * unique-constraint collision. The 6-digit space (900,000 values/day) just
 * keeps collisions rare in practice.
 */
export function generateOrderNumber(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `IC-${y}${m}${d}-${rand}`;
}
