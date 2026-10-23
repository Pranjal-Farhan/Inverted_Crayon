"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { requireAdminArea } from "@/lib/admin-guard";
import { notifyOrderCancelled, notifyOrderDelivered, notifyOrderShipped, notifyOrderUpdated } from "@/lib/notifications";
import { CANCELLABLE_STATUSES } from "@/lib/order-status";
import { afterStockChanged, changeStock, type StockChange } from "@/lib/stock";
import { fail, guarded, OK, UserError, type Result } from "@/lib/action-errors";

/**
 * Order actions. Each one answers { ok, error }: the order page shows the reason in words when
 * something can't be done (an order that has already moved on, say) instead of silently doing
 * nothing. Status moves are "claims" — one atomic UPDATE that only succeeds from the allowed
 * statuses — so two clicks, or two admins, can't both win and (for cancel/refund) restock twice.
 */

async function requireAdmin() {
  return requireAdminArea("orders");
}

function refresh(orderId: string) {
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
  revalidatePath("/admin/finance", "layout");
}

export async function markOrderShipped(orderId: string, courier: string, trackingRef: string): Promise<Result> {
  return guarded("markOrderShipped", async () => {
    const admin = await requireAdmin();
    const order = await db.order.findUnique({ where: { id: orderId }, select: { source: true } });
    if (!order) return fail("That order no longer exists.");
    // A recorded sale can be sent without a courier reference; a website order needs one so the customer can track it.
    if (order.source === "ONLINE" && !trackingRef.trim()) return fail("Enter the tracking reference before marking it sent for delivery.");
    const claimed = await db.order.updateMany({
      where: { id: orderId, status: { in: [...CANCELLABLE_STATUSES] } },
      data: { status: "SHIPPED", trackingCourier: courier.trim() || null, trackingRef: trackingRef.trim() || null },
    });
    if (claimed.count === 0) return fail("This order has already moved on (sent, delivered, cancelled or refunded), so it can't be marked sent for delivery.");
    // Customer: shipped email. Brand: an order-update email.
    await notifyOrderShipped(orderId, admin);
    refresh(orderId);
    return OK;
  });
}

export async function markOrderDelivered(orderId: string): Promise<Result> {
  return guarded("markOrderDelivered", async () => {
    const admin = await requireAdmin();
    // deliveredAt is the day the sale counts in the finance reports.
    const claimed = await db.order.updateMany({
      where: { id: orderId, status: { in: ["PENDING", "PAID", "PROCESSING", "SHIPPED"] } },
      data: { status: "DELIVERED", deliveredAt: new Date() },
    });
    if (claimed.count === 0) return fail("This order can't be marked delivered — it is already delivered, cancelled, refunded or returned.");
    await notifyOrderDelivered(orderId, admin);
    refresh(orderId);
    return OK;
  });
}

/** Puts the items of an order back on the shelf. Preorder lines never took stock, and lines with no variant link never did either. */
async function restockItems(
  tx: Prisma.TransactionClient,
  order: { id: string; number: string; items: { variantId: string | null; qty: number; isPreorder: boolean }[] },
  note: string,
  actorEmail: string,
  changes: StockChange[],
) {
  for (const item of order.items) {
    if (!item.isPreorder && item.variantId) {
      changes.push(await changeStock(tx, { variantId: item.variantId, delta: item.qty, reason: "ORDER_RESTORED", orderId: order.id, orderNumber: order.number, note, actorEmail }));
    }
  }
}

/**
 * Cancels an order that hasn't been sent for delivery: it becomes CANCELLED, its stock goes back,
 * and the customer is emailed the confirmation (with the receipt, which now reads Cancelled). This
 * is the button for "the customer asked to cancel" — and for cancelling on the team's own initiative.
 */
export async function cancelOrder(orderId: string): Promise<Result> {
  return guarded("cancelOrder", async () => {
    const admin = await requireAdmin();
    const changes: StockChange[] = [];
    let cancelled = false;
    await db.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
      if (!order) throw new UserError("That order no longer exists.");

      // Atomic claim, so two clicks (or a click racing a "Mark sent for delivery") can't both win and
      // restock twice. An order that's already shipped, delivered, refunded or cancelled isn't claimed.
      const claimed = await tx.order.updateMany({
        where: { id: orderId, status: { in: [...CANCELLABLE_STATUSES] } },
        // Money that was actually received has to go back; an unpaid cash-on-delivery order has none.
        data: { status: "CANCELLED", ...(order.paymentStatus === "PAID" ? { paymentStatus: "REFUNDED" } : {}) },
      });
      if (claimed.count === 0) throw new UserError("This order can only be cancelled before it is sent for delivery — it has already moved on. Use Refund instead.");
      cancelled = true;
      await restockItems(tx, order, "Order cancelled", admin.email, changes);
    });
    if (cancelled) await notifyOrderCancelled(orderId, "Cancelled — stock restored", admin);
    refresh(orderId);
    await afterStockChanged(changes);
    return OK;
  });
}

export async function refundOrder(orderId: string): Promise<Result> {
  return guarded("refundOrder", async () => {
    const admin = await requireAdmin();
    const changes: StockChange[] = [];
    // Refunding an order that hadn't shipped and that the customer asked to cancel *is* the
    // cancellation being confirmed — so the customer gets the cancellation email, not just the team.
    let confirmsCancellation = false;
    await db.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
      if (!order) throw new UserError("That order no longer exists.");

      // Atomic claim on the REFUNDED transition: two concurrent refund clicks could otherwise both
      // read status as not-yet-refunded before either commits, and both restock — double-crediting
      // inventory that was only actually returned once. A cancelled order was already restocked, so
      // it can't be refunded (and restocked) a second time either.
      const claimed = await tx.order.updateMany({
        where: { id: orderId, status: { notIn: ["REFUNDED", "CANCELLED"] } },
        data: { status: "REFUNDED", paymentStatus: "REFUNDED" },
      });
      if (claimed.count === 0) throw new UserError("This order is already refunded or cancelled — its stock was already put back, so nothing was changed.");
      confirmsCancellation = order.cancellationRequestedAt !== null && (CANCELLABLE_STATUSES as readonly string[]).includes(order.status);
      await restockItems(tx, order, "Order refunded", admin.email, changes);
    });
    if (confirmsCancellation) await notifyOrderCancelled(orderId, "Refunded — stock restored (the customer had asked to cancel)", admin);
    else await notifyOrderUpdated(orderId, "Refunded — stock restored", admin);
    refresh(orderId);
    await afterStockChanged(changes);
    return OK;
  });
}

export async function updateOrderNotes(orderId: string, notes: string): Promise<Result> {
  return guarded("updateOrderNotes", async () => {
    await requireAdmin();
    const found = await db.order.updateMany({ where: { id: orderId }, data: { internalNotes: notes } });
    if (found.count === 0) return fail("That order no longer exists.");
    revalidatePath(`/admin/orders/${orderId}`);
    return OK;
  });
}

/** Marks the cash on delivery as collected (the order page's own tracking of the courier's cash). */
export async function markBalanceCollected(orderId: string): Promise<Result> {
  return guarded("markBalanceCollected", async () => {
    const admin = await requireAdmin();
    const found = await db.order.updateMany({ where: { id: orderId }, data: { balanceCollected: true, cashCollectedAt: new Date() } });
    if (found.count === 0) return fail("That order no longer exists.");
    await notifyOrderUpdated(orderId, "Cash on delivery marked as collected", admin);
    revalidatePath(`/admin/orders/${orderId}`);
    return OK;
  });
}

/** For a mistaken "collected" click: the order goes back to awaiting its cash. */
export async function unmarkBalanceCollected(orderId: string): Promise<Result> {
  return guarded("unmarkBalanceCollected", async () => {
    const admin = await requireAdmin();
    const found = await db.order.updateMany({ where: { id: orderId }, data: { balanceCollected: false, cashCollectedAt: null } });
    if (found.count === 0) return fail("That order no longer exists.");
    await notifyOrderUpdated(orderId, "Cash on delivery set back to not collected", admin);
    revalidatePath(`/admin/orders/${orderId}`);
    return OK;
  });
}
