import { randomInt } from "node:crypto";

/**
 * Human-facing order number. Not guaranteed unique on its own (Order.number
 * is `@unique` in the schema) — callers must retry with a fresh number on a
 * unique-constraint collision. The 6-digit space (900,000 values/day) just
 * keeps collisions rare in practice.
 *
 * The digits come from a cryptographic RNG, not Math.random(): an order number is what the public
 * order pages and the card-payment return URL look orders up by, so one order's number mustn't hint
 * at the next one's.
 */
export function generateOrderNumber(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const rand = randomInt(100000, 1000000);
  return `IC-${y}${m}${d}-${rand}`;
}
