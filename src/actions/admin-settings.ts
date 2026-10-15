"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getAdminSession } from "@/lib/session";
import { invalidateSettings } from "@/lib/invalidate";
import type { ChatWidgetSettings, StoreInfo } from "@/lib/store-settings";

async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) throw new Error("Not authorized.");
}

export async function saveStoreInfo(info: StoreInfo) {
  await requireAdmin();
  await db.storeSetting.upsert({ where: { key: "store_info" }, update: { value: info }, create: { key: "store_info", value: info } });
  revalidatePath("/admin/settings");
  revalidatePath("/contact");
  invalidateSettings();
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
