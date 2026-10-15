"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { requireAdminArea } from "@/lib/admin-guard";
import { notifyOrderCancelled, notifyOrderDelivered, notifyOrderShipped, notifyOrderUpdated } from "@/lib/notifications";
import { CANCELLABLE_STATUSES } from "@/lib/order-status";
import { invalidateProduct } from "@/lib/invalidate";

async function requireAdmin() {
  return requireAdminArea("orders");
}

export async function markOrderShipped(orderId: string, courier: string, trackingRef: string) {
  const admin = await requireAdmin();
  await db.order.update({
    where: { id: orderId },
    data: { status: "SHIPPED", trackingCourier: courier, trackingRef },
  });
  // Customer: shipped email. Brand: an order-update email.
  await notifyOrderShipped(orderId, admin);
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
}

export async function markOrderDelivered(orderId: string) {
  const admin = await requireAdmin();
  // deliveredAt is the day the sale (and, for cash on delivery, the money) counts in the finance reports.
  await db.order.update({ where: { id: orderId }, data: { status: "DELIVERED", deliveredAt: new Date() } });
  await notifyOrderDelivered(orderId, admin);
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
}

/** Puts the items of an order back on the shelf. Preorder lines never took stock, so they're skipped. */
async function restockItems(
  tx: Prisma.TransactionClient,
  items: { variantId: string | null; productId: string | null; qty: number; isPreorder: boolean }[],
  restockedProductIds: Set<string>,
) {
  for (const item of items) {
    if (!item.isPreorder && item.variantId) {
      await tx.variant.update({ where: { id: item.variantId }, data: { stockQty: { increment: item.qty } } });
      if (item.productId) restockedProductIds.add(item.productId);
    }
  }
}

/** Restocking can flip a sold-out/preorder badge back — refresh every affected product's pages. */
async function invalidateRestocked(restockedProductIds: Set<string>) {
  if (restockedProductIds.size === 0) return;
  const products = await db.product.findMany({ where: { id: { in: [...restockedProductIds] } }, select: { id: true, slug: true } });
  for (const p of products) invalidateProduct({ id: p.id, slug: p.slug });
}

/**
 * Cancels an order that hasn't been sent for delivery: it becomes CANCELLED, its stock goes back,
 * and the customer is emailed the confirmation (with the receipt, which now reads Cancelled). This
 * is the button for "the customer asked to cancel" — and for cancelling on the team's own initiative.
 */
export async function cancelOrder(orderId: string) {
  const admin = await requireAdmin();
  const restockedProductIds = new Set<string>();
  let cancelled = false;
  await db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order) return;

    // Atomic claim, so two clicks (or a click racing a "Mark sent for delivery") can't both win and
    // restock twice. An order that's already shipped, delivered, refunded or cancelled isn't claimed.
    const claimed = await tx.order.updateMany({
      where: { id: orderId, status: { in: [...CANCELLABLE_STATUSES] } },
      // Money that was actually received has to go back; an unpaid cash-on-delivery order has none.
      data: { status: "CANCELLED", ...(order.paymentStatus === "PAID" ? { paymentStatus: "REFUNDED" } : {}) },
    });
    if (claimed.count === 0) return;
    cancelled = true;
    await restockItems(tx, order.items, restockedProductIds);
  });
  if (cancelled) await notifyOrderCancelled(orderId, "Cancelled — stock restored", admin);
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
  await invalidateRestocked(restockedProductIds);
}

export async function refundOrder(orderId: string) {
  const admin = await requireAdmin();
  const restockedProductIds = new Set<string>();
  let refunded = false;
  // Refunding an order that hadn't shipped and that the customer asked to cancel *is* the
  // cancellation being confirmed — so the customer gets the cancellation email, not just the team.
  let confirmsCancellation = false;
  await db.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });

    // Atomic claim on the REFUNDED transition: two concurrent refund clicks could otherwise both
    // read status as not-yet-refunded before either commits, and both restock — double-crediting
    // inventory that was only actually returned once. A cancelled order was already restocked, so
    // it can't be refunded (and restocked) a second time either.
    const claimed = await tx.order.updateMany({
      where: { id: orderId, status: { notIn: ["REFUNDED", "CANCELLED"] } },
      data: { status: "REFUNDED", paymentStatus: "REFUNDED" },
    });
    if (claimed.count === 0) return; // already refunded or cancelled
    refunded = true;
    confirmsCancellation =
      order.cancellationRequestedAt !== null && (CANCELLABLE_STATUSES as readonly string[]).includes(order.status);

    await restockItems(tx, order.items, restockedProductIds);
  });
  if (refunded) {
    if (confirmsCancellation) await notifyOrderCancelled(orderId, "Refunded — stock restored (the customer had asked to cancel)", admin);
    else await notifyOrderUpdated(orderId, "Refunded — stock restored", admin);
  }
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
  await invalidateRestocked(restockedProductIds);
}

export async function updateOrderNotes(orderId: string, notes: string) {
  await requireAdmin();
  await db.order.update({ where: { id: orderId }, data: { internalNotes: notes } });
  revalidatePath(`/admin/orders/${orderId}`);
}

/** Marks the cash on delivery as collected — the date it was collected (now) is what the finance reports count the money from. */
export async function markBalanceCollected(orderId: string) {
  const admin = await requireAdmin();
  await db.order.update({ where: { id: orderId }, data: { balanceCollected: true, cashCollectedAt: new Date() } });
  await notifyOrderUpdated(orderId, "Cash on delivery marked as collected", admin);
  revalidatePath(`/admin/orders/${orderId}`);
}

/** For a mistaken "collected" click: the order goes back to awaiting its cash. */
export async function unmarkBalanceCollected(orderId: string) {
  const admin = await requireAdmin();
  await db.order.update({ where: { id: orderId }, data: { balanceCollected: false, cashCollectedAt: null } });
  await notifyOrderUpdated(orderId, "Cash on delivery set back to not collected", admin);
  revalidatePath(`/admin/orders/${orderId}`);
}
