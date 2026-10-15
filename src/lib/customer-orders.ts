/**
 * How the admin's Customers section sorts a person's orders: CURRENT = still in motion (placed,
 * paid, being prepared, or out for delivery); PAST = finished one way or another (delivered,
 * cancelled, refunded, returned). Client-safe — pure functions only.
 */
export const CURRENT_STATUSES: readonly string[] = ["PENDING", "PAID", "PROCESSING", "SHIPPED"];

export const isCurrentOrder = (status: string) => CURRENT_STATUSES.includes(status);

/** Splits orders (newest first in, newest first out) into the ones still in motion and the finished ones. */
export function splitOrders<T extends { status: string }>(orders: T[]): { current: T[]; past: T[] } {
  return { current: orders.filter((o) => isCurrentOrder(o.status)), past: orders.filter((o) => !isCurrentOrder(o.status)) };
}

const digits = (s: string) => s.replace(/\D/g, "");

/** Distinct phone numbers, ignoring formatting differences (01712-345678 vs 01712345678), first spelling kept. */
export function distinctPhones(phones: (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of phones) {
    if (!p) continue;
    const key = digits(p).replace(/^880/, "0");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(p.trim());
  }
  return out;
}

export type ShipTo = { fullName: string; phone: string; line1: string; area: string; district: string; postcode: string; country: string };

/** Distinct delivery addresses taken from orders (newest first), for people with no saved address book. */
export function distinctShipTo(
  orders: { shippingFullName: string; shippingPhone: string; shippingLine1: string; shippingArea: string; shippingDistrict: string; shippingPostcode: string; shippingCountry: string }[],
): ShipTo[] {
  const seen = new Set<string>();
  const out: ShipTo[] = [];
  for (const o of orders) {
    const key = [o.shippingLine1, o.shippingArea, o.shippingDistrict, o.shippingPostcode].map((x) => x.trim().toLowerCase()).join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      fullName: o.shippingFullName,
      phone: o.shippingPhone,
      line1: o.shippingLine1,
      area: o.shippingArea,
      district: o.shippingDistrict,
      postcode: o.shippingPostcode,
      country: o.shippingCountry,
    });
  }
  return out;
}
