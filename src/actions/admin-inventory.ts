"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getAdminSession } from "@/lib/session";

export async function setVariantStock(variantId: string, stockQty: number) {
  const session = await getAdminSession();
  if (!session) throw new Error("Not authorized.");
  await db.variant.update({ where: { id: variantId }, data: { stockQty: Math.max(stockQty, 0) } });
  revalidatePath("/admin/inventory");
  revalidatePath("/admin/products");
}
