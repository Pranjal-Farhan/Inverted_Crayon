"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getAdminSession } from "@/lib/session";

async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) throw new Error("Not authorized.");
}

export async function saveHomeHero(data: { eyebrow: string; headline: string; sub: string; subBold: string; badge: string }) {
  await requireAdmin();
  await db.contentBlock.upsert({ where: { key: "home_hero" }, update: { data }, create: { key: "home_hero", data } });
  revalidatePath("/");
  revalidatePath("/admin/content");
}

export async function saveFeaturedDrop(productId: string | null) {
  await requireAdmin();
  await db.contentBlock.upsert({
    where: { key: "home_featured_drop" },
    update: { data: { productId } },
    create: { key: "home_featured_drop", data: { productId } },
  });
  revalidatePath("/");
  revalidatePath("/admin/content");
}
