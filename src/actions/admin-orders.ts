"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getAdminSession } from "@/lib/session";

async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) throw new Error("Not authorized.");
  return session;
}

export async function markOrderShipped(orderId: string, courier: string, trackingRef: string) {
  await requireAdmin();
  await db.order.update({
    where: { id: orderId },
    data: { status: "SHIPPED", trackingCourier: courier, trackingRef },
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
    if (order.status === "REFUNDED") return;
    for (const item of order.items) {
      if (!item.isPreorder && item.variantId) {
        await tx.variant.update({ where: { id: item.variantId }, data: { stockQty: { increment: item.qty } } });
      }
    }
    await tx.order.update({ where: { id: orderId }, data: { status: "REFUNDED", paymentStatus: "REFUNDED" } });
  });
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
}

export async function updateOrderNotes(orderId: string, notes: string) {
  await requireAdmin();
  await db.order.update({ where: { id: orderId }, data: { internalNotes: notes } });
  revalidatePath(`/admin/orders/${orderId}`);
}
