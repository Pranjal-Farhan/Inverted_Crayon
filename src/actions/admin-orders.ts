"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getAdminSession } from "@/lib/session";
import { sendMail } from "@/lib/mail";

async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) throw new Error("Not authorized.");
  return session;
}

export async function markOrderShipped(orderId: string, courier: string, trackingRef: string) {
  await requireAdmin();
  const order = await db.order.update({
    where: { id: orderId },
    data: { status: "SHIPPED", trackingCourier: courier, trackingRef },
  });
  await sendMail({
    to: order.email,
    subject: "It's shipped",
    body: `Order #${order.number} is on its way via ${courier} — tracking ref ${trackingRef}.`,
    type: "ORDER_SHIPPED",
    relatedOrderId: order.number,
  });
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
}

export async function markOrderDelivered(orderId: string) {
  await requireAdmin();
  await db.order.update({ where: { id: orderId }, data: { status: "DELIVERED" } });
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
}

export async function markOrderProcessing(orderId: string) {
  await requireAdmin();
  await db.order.update({ where: { id: orderId }, data: { status: "PROCESSING" } });
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
}

export async function refundOrder(orderId: string) {
  await requireAdmin();
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

    for (const item of order.items) {
      if (!item.isPreorder && item.variantId) {
        await tx.variant.update({ where: { id: item.variantId }, data: { stockQty: { increment: item.qty } } });
      }
    }
  });
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
}

export async function updateOrderNotes(orderId: string, notes: string) {
  await requireAdmin();
  await db.order.update({ where: { id: orderId }, data: { internalNotes: notes } });
  revalidatePath(`/admin/orders/${orderId}`);
}
