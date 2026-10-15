"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getAdminSession } from "@/lib/session";
import { invalidateSettings } from "@/lib/invalidate";
import type { ChatWidgetSettings, PaymentGatewaySettings, ShippingRates, StoreInfo, TaxSettings } from "@/lib/store-settings";

async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) throw new Error("Not authorized.");
}

export async function saveShippingRates(rates: ShippingRates) {
  await requireAdmin();
  await db.storeSetting.upsert({ where: { key: "shipping_rates" }, update: { value: rates }, create: { key: "shipping_rates", value: rates } });
  revalidatePath("/admin/settings");
  revalidatePath("/checkout");
}

export async function savePaymentGateways(gateways: PaymentGatewaySettings) {
  await requireAdmin();
  await db.storeSetting.upsert({
    where: { key: "payment_gateways" },
    update: { value: gateways },
    create: { key: "payment_gateways", value: gateways },
  });
  revalidatePath("/admin/settings");
  revalidatePath("/checkout");
}

export async function saveStoreInfo(info: StoreInfo) {
  await requireAdmin();
  await db.storeSetting.upsert({ where: { key: "store_info" }, update: { value: info }, create: { key: "store_info", value: info } });
  revalidatePath("/admin/settings");
  revalidatePath("/contact");
  invalidateSettings();
}

export async function saveTaxSettings(tax: TaxSettings) {
  await requireAdmin();
  await db.storeSetting.upsert({ where: { key: "tax_settings" }, update: { value: tax }, create: { key: "tax_settings", value: tax } });
  revalidatePath("/admin/settings");
}

export async function saveChatWidgetSettings(settings: ChatWidgetSettings) {
  await requireAdmin();
  await db.storeSetting.upsert({
    where: { key: "chat_widget" },
    update: { value: settings },
    create: { key: "chat_widget", value: settings },
  });
  revalidatePath("/admin/settings");
  revalidatePath("/", "layout");
  invalidateSettings();
}
