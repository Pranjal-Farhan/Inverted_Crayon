import { db } from "@/lib/db";

export type ShippingZoneRate = {
  label: string;
  cost: number;
  etaDays: string;
};

export type ShippingRates = {
  INSIDE_DHAKA: ShippingZoneRate;
  OUTSIDE_DHAKA: ShippingZoneRate;
  INTERNATIONAL: ShippingZoneRate;
};

export const DEFAULT_SHIPPING_RATES: ShippingRates = {
  INSIDE_DHAKA: { label: "Inside Dhaka", cost: 60, etaDays: "2–3 days" },
  OUTSIDE_DHAKA: { label: "Outside Dhaka", cost: 120, etaDays: "3–5 days" },
  INTERNATIONAL: { label: "International", cost: 1800, etaDays: "7–14 days" },
};

export type PaymentGatewaySettings = {
  bkash: boolean;
  nagad: boolean;
  sslcommerz: boolean;
  cod: boolean;
  codRule: "inside_dhaka_only" | "nationwide";
};

export const DEFAULT_PAYMENT_GATEWAYS: PaymentGatewaySettings = {
  bkash: true,
  nagad: true,
  sslcommerz: true,
  cod: true,
  codRule: "inside_dhaka_only",
};

export type StoreInfo = {
  name: string;
  email: string;
  phone: string;
  address: string;
};

export const DEFAULT_STORE_INFO: StoreInfo = {
  name: "Inverted Crayon",
  email: "hello@invertedcrayon.com",
  phone: "+880 1XXX-XXXXXX",
  address: "Dhaka, Bangladesh",
};

async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.storeSetting.findUnique({ where: { key } });
  if (!row) return fallback;
  return { ...fallback, ...(row.value as object) } as T;
}

export async function getShippingRates(): Promise<ShippingRates> {
  return getSetting("shipping_rates", DEFAULT_SHIPPING_RATES);
}

export async function getPaymentGateways(): Promise<PaymentGatewaySettings> {
  return getSetting("payment_gateways", DEFAULT_PAYMENT_GATEWAYS);
}

export async function getStoreInfo(): Promise<StoreInfo> {
  return getSetting("store_info", DEFAULT_STORE_INFO);
}

export async function setSetting(key: string, value: unknown) {
  await db.storeSetting.upsert({
    where: { key },
    update: { value: value as never },
    create: { key, value: value as never },
  });
}
