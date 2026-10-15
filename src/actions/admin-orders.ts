"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getAdminSession } from "@/lib/session";
import { notifyOrderDelivered, notifyOrderShipped, notifyOrderUpdated } from "@/lib/notifications";
import { invalidateProduct } from "@/lib/invalidate";

async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) throw new Error("Not authorized.");
  return session;
}

export async function markOrderShipped(orderId: string, courier: string, trackingRef: string) {
  const admin = await requireAdmin();
  await db.order.update({
    where: { id: orderId },
    data: { status: "SHIPPED", trackingCourier: courier, trackingRef },
  });
  // Customer: shipped email + SMS. Brand: an order-update email.
  await notifyOrderShipped(orderId, admin);
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
}

export async function markOrderDelivered(orderId: string) {
  const admin = await requireAdmin();
  await db.order.update({ where: { id: orderId }, data: { status: "DELIVERED" } });
  await notifyOrderDelivered(orderId, admin);
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
}

export async function refundOrder(orderId: string) {
  const admin = await requireAdmin();
  const restockedProductIds = new Set<string>();
  let refunded = false;
  await db.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });

    // Atomic claim on the REFUNDED transition: two concurrent refund clicks could otherwise both
    // read status as not-yet-refunded before either commits, and both restock — double-crediting
    // inventory that was only actually returned once.
    const claimed = await tx.order.updateMany({
      where: { id: orderId, status: { not: "REFUNDED" } },
      data: { status: "REFUNDED", paymentStatus: "REFUNDED" },
    });
    if (claimed.count === 0) return; // already refunded
    refunded = true;

    for (const item of order.items) {
      if (!item.isPreorder && item.variantId) {
        await tx.variant.update({ where: { id: item.variantId }, data: { stockQty: { increment: item.qty } } });
        if (item.productId) restockedProductIds.add(item.productId);
      }
    }
  });
  if (refunded) await notifyOrderUpdated(orderId, "Refunded — stock restored", admin);
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
  if (restockedProductIds.size > 0) {
    const products = await db.product.findMany({ where: { id: { in: [...restockedProductIds] } }, select: { id: true, slug: true } });
    for (const p of products) invalidateProduct({ id: p.id, slug: p.slug });
  }
}

export async function updateOrderNotes(orderId: string, notes: string) {
  await requireAdmin();
  await db.order.update({ where: { id: orderId }, data: { internalNotes: notes } });
  revalidatePath(`/admin/orders/${orderId}`);
}

/** Marks a preorder's cash-on-delivery balance as collected — purely a record-keeping flag, doesn't touch paymentStatus (that still tracks the online advance). */
export async function markBalanceCollected(orderId: string) {
  const admin = await requireAdmin();
  await db.order.update({ where: { id: orderId }, data: { balanceCollected: true } });
  await notifyOrderUpdated(orderId, "Cash-on-delivery balance marked as collected", admin);
  revalidatePath(`/admin/orders/${orderId}`);
}
