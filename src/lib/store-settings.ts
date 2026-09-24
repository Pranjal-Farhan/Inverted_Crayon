import { db } from "@/lib/db";
import type { $Enums } from "@/generated/prisma/client";

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
  sslcommerz: boolean;
  cod: boolean;
  codRule: "inside_dhaka_only" | "nationwide";
};

export const DEFAULT_PAYMENT_GATEWAYS: PaymentGatewaySettings = {
  bkash: true,
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

export type TaxSettings = {
  rate: number;
  inclusive: boolean;
  label: string;
};

export const DEFAULT_TAX_SETTINGS: TaxSettings = {
  rate: 0,
  inclusive: true,
  label: "VAT (included in listed price)",
};

export type EmailTemplateConfig = { subject: string; enabled: boolean };
export type EmailTemplates = Record<$Enums.EmailType, EmailTemplateConfig>;

export const DEFAULT_EMAIL_TEMPLATES: EmailTemplates = {
  WELCOME: { subject: "Stay inverted.", enabled: true },
  ORDER_CONFIRMED: { subject: "Order confirmed", enabled: true },
  ORDER_SHIPPED: { subject: "It's shipped", enabled: true },
  BACK_IN_STOCK: { subject: "Back in stock", enabled: true },
  PREORDER_SHIP_UPDATE: { subject: "Your preorder ships soon", enabled: true },
  ABANDONED_CHECKOUT: { subject: "You left something behind", enabled: true },
  CONTACT_RECEIVED: { subject: "We got your message", enabled: true },
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

export async function getTaxSettings(): Promise<TaxSettings> {
  return getSetting("tax_settings", DEFAULT_TAX_SETTINGS);
}

export async function getChatWidgetSettings(): Promise<ChatWidgetSettings> {
  return getSetting("chat_widget", DEFAULT_CHAT_WIDGET_SETTINGS);
}

export async function getEmailTemplates(): Promise<EmailTemplates> {
  return getSetting("email_templates", DEFAULT_EMAIL_TEMPLATES);
}

export async function setSetting(key: string, value: unknown) {
  await db.storeSetting.upsert({
    where: { key },
    update: { value: value as never },
    create: { key, value: value as never },
  });
}
