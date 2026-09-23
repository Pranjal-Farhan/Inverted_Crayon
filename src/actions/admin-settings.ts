"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getAdminSession } from "@/lib/session";
import type { EmailTemplates, PaymentGatewaySettings, ShippingRates, StoreInfo, TaxSettings } from "@/lib/store-settings";

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
}

export async function saveTaxSettings(tax: TaxSettings) {
  await requireAdmin();
  await db.storeSetting.upsert({ where: { key: "tax_settings" }, update: { value: tax }, create: { key: "tax_settings", value: tax } });
  revalidatePath("/admin/settings");
}

export async function saveEmailTemplates(templates: EmailTemplates) {
  await requireAdmin();
  await db.storeSetting.upsert({
    where: { key: "email_templates" },
    update: { value: templates },
    create: { key: "email_templates", value: templates },
  });
  revalidatePath("/admin/settings");
}
