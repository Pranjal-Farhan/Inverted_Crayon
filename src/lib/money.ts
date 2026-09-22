/**
 * All prices are Bangladeshi Taka. Format: ৳1,450.00
 * (symbol, comma thousands, 2 decimals) — Build Spec §00/§03.
 */
export function formatTaka(amount: number | string): string {
  const n = typeof amount === "string" ? Number(amount) : amount;
  return (
    "৳" +
    n.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
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
