import type { ShippingRates } from "@/lib/store-settings";

export type ShippingZoneKey = keyof ShippingRates;

type DeliveryOverride = {
  deliveryChargeInsideDhaka: number | null;
  deliveryChargeOutsideDhaka: number | null;
};

/**
 * The one place both checkout.ts (authoritative charge) and CheckoutView.tsx (what the customer
 * sees before paying) compute an order's shipping cost from — so the number shown always matches
 * the number charged. A product can override the store's flat per-zone rate (store-settings.ts);
 * when a cart mixes several such products, the highest override applies (they ship as one
 * shipment, so the largest single-product cost is what the delivery actually costs). Falls back
 * to the store default when nothing in the cart sets an override for this zone.
 */
export function resolveShippingCost(lines: DeliveryOverride[], zone: ShippingZoneKey, rates: ShippingRates): number {
  const key = zone === "INSIDE_DHAKA" ? "deliveryChargeInsideDhaka" : "deliveryChargeOutsideDhaka";
  const overrides = lines.map((l) => l[key]).filter((v): v is number => v != null);
  if (overrides.length === 0) return rates[zone].cost;
  return Math.max(...overrides);
}
