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
    const subscriberEmails = new Set(subs.map((s) => s.email.toLowerCase()));
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

    // Also notify anyone who's wishlisted this product (wishlist is product-level, not
    // variant-level, so this fires on any variant of the product coming back) — skip anyone
    // already emailed above via an explicit "notify me" subscription, and anyone already
    // notified since the product last went fully out of stock (see the reset below).
    const wishlisters = await db.wishlistItem.findMany({
      where: { productId: before.productId, notifiedAt: null },
      include: { customer: true },
    });
    const toNotify = wishlisters.filter((w) => !subscriberEmails.has(w.customer.email.toLowerCase()));
    for (const w of toNotify) {
      await sendMail({
        to: w.customer.email,
        subject: "Back in stock",
        body: `${before.product.title} is back in stock — it's on your wishlist. Grab it before it's gone again.`,
        type: "BACK_IN_STOCK",
      });
    }
    if (toNotify.length > 0) {
      await db.wishlistItem.updateMany({
        where: { id: { in: toNotify.map((w) => w.id) } },
        data: { notifiedAt: new Date() },
      });
    }
  }

  if (before.stockQty > 0 && nextQty === 0) {
    const remainingStock = await db.variant.aggregate({
      where: { productId: before.productId },
      _sum: { stockQty: true },
    });
    if ((remainingStock._sum.stockQty ?? 0) === 0) {
      // Fully sold out again — clear the notified flag so a future restock re-notifies wishlisters.
      await db.wishlistItem.updateMany({ where: { productId: before.productId }, data: { notifiedAt: null } });
    }
  }

  revalidatePath("/admin/inventory");
  revalidatePath("/admin/products");
}
