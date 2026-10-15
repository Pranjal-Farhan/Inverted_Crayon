/**
 * All prices are Bangladeshi Taka. Format: ৳1,450 — symbol, comma thousands, no decimals (Taka
 * isn't subdivided in everyday use here, so a trailing ".00" is just noise). Rounds to the
 * nearest whole Taka rather than truncating, so e.g. ৳1,449.60 shows as ৳1,450.
 */
export function formatTaka(amount: number | string): string {
  const n = typeof amount === "string" ? Number(amount) : amount;
  return "৳" + Math.round(n).toLocaleString("en-US");
}

export function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  // Prisma Decimal has a toNumber() method
  if (value && typeof value === "object" && "toNumber" in value) {
    return (value as { toNumber: () => number }).toNumber();
  }
  return Number(value ?? 0);
}

/** For statements and ledgers, where every paisa matters: ৳1,234.50 — decimals only when there are some. */
export function formatTakaPrecise(amount: number): string {
  const n = Math.round(amount * 100) / 100;
  const sign = n < 0 ? "−" : "";
  const abs = Math.abs(n);
  return sign + "৳" + abs.toLocaleString("en-US", { minimumFractionDigits: Number.isInteger(abs) ? 0 : 2, maximumFractionDigits: 2 });
}

/** A signed amount for profit/loss figures: +৳1,200 or −৳300 (no sign shown for zero). */
export function formatTakaSigned(amount: number): string {
  const rounded = Math.round(amount);
  return (rounded > 0 ? "+" : "") + formatTaka(rounded).replace("৳-", "−৳");
}
