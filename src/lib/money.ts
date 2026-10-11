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
