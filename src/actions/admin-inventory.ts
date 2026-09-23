"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getAdminSession } from "@/lib/session";
import { sendMail } from "@/lib/mail";

export async function setVariantStock(variantId: string, stockQty: number) {
  const session = await getAdminSession();
  if (!session) throw new Error("Not authorized.");

  const before = await db.variant.findUniqueOrThrow({ where: { id: variantId }, include: { product: true } });
  const nextQty = Math.max(stockQty, 0);
  await db.variant.update({ where: { id: variantId }, data: { stockQty: nextQty } });

  if (before.stockQty === 0 && nextQty > 0) {
    const subs = await db.backInStockSubscription.findMany({ where: { variantId, notifiedAt: null } });
    for (const sub of subs) {
      await sendMail({
        to: sub.email,
        subject: "Back in stock",
        body: `${before.product.title} (${before.size} / ${before.color}) is back — grab it before it's gone again.`,
        type: "BACK_IN_STOCK",
      });
    }
    if (subs.length > 0) {
      await db.backInStockSubscription.updateMany({
        where: { variantId, notifiedAt: null },
        data: { notifiedAt: new Date() },
      });
    }
  }

  revalidatePath("/admin/inventory");
  revalidatePath("/admin/products");
}
