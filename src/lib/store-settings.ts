import { db } from "@/lib/db";

export type ShippingZoneRate = {
  label: string;
  cost: number;
  etaDays: string;
};

export type ShippingRates = {
  INSIDE_DHAKA: ShippingZoneRate;
  OUTSIDE_DHAKA: ShippingZoneRate;
};

// The standard delivery rate per zone. There's no settings screen for it any more: each product
// carries its own delivery charge (product editor -> Delivery charge), and these are what a
// product with no charge of its own falls back to. A `shipping_rates` StoreSetting row, if one
// already exists, still overrides these so a deploy never changes what customers are charged.
export const DEFAULT_SHIPPING_RATES: ShippingRates = {
  INSIDE_DHAKA: { label: "Inside Dhaka", cost: 60, etaDays: "2–3 days" },
  OUTSIDE_DHAKA: { label: "Outside Dhaka", cost: 120, etaDays: "3–5 days" },
};

export type StoreInfo = {
  name: string;
  email: string;
  phone: string;
  address: string;
};

export const DEFAULT_STORE_INFO: StoreInfo = {
  name: "Inverted Crayon",
  email: "invertedcrayonofficial@gmail.com",
  phone: "+880 17725-46800",
  address: "Dhaka, Bangladesh",
};

export type ChatWidgetSettings = {
  enabled: boolean;
  whatsappNumber: string; // digits only or with punctuation — normalized when building the link
  whatsappMessage: string;
  messengerUsername: string; // the page's username or numeric ID, as it appears in m.me/<this>
};

export const DEFAULT_CHAT_WIDGET_SETTINGS: ChatWidgetSettings = {
  enabled: false,
  whatsappNumber: "",
  whatsappMessage: "Hi! I have a question about an order.",
  messengerUsername: "",
};

async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.storeSetting.findUnique({ where: { key } });
  if (!row) return fallback;
  return { ...fallback, ...(row.value as object) } as T;
}

export async function getShippingRates(): Promise<ShippingRates> {
  return getSetting("shipping_rates", DEFAULT_SHIPPING_RATES);
}

export async function getStoreInfo(): Promise<StoreInfo> {
  return getSetting("store_info", DEFAULT_STORE_INFO);
}

export async function getChatWidgetSettings(): Promise<ChatWidgetSettings> {
  return getSetting("chat_widget", DEFAULT_CHAT_WIDGET_SETTINGS);
}

export async function setSetting(key: string, value: unknown) {
  await db.storeSetting.upsert({
    where: { key },
    update: { value: value as never },
    create: { key, value: value as never },
  });
}
