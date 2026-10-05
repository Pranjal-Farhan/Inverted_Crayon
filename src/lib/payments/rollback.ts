import "server-only";
import { db } from "@/lib/db";
import { invalidateProduct } from "@/lib/invalidate";

/** Used when a gateway payment fails/cancels/errors after the order (and its stock hold) was already created. */
export async function restockAndCancelOrder(orderId: string) {
  const restockedProductIds = new Set<string>();

  await db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order || order.status === "CANCELLED") return;

    for (const item of order.items) {
      if (!item.isPreorder && item.variantId) {
        await tx.variant.update({ where: { id: item.variantId }, data: { stockQty: { increment: item.qty } } });
        if (item.productId) restockedProductIds.add(item.productId);
      }
    }
    if (order.discountCode) {
      await tx.discount.updateMany({ where: { code: order.discountCode }, data: { usedCount: { decrement: 1 } } });
    }
    await tx.order.update({ where: { id: orderId }, data: { status: "CANCELLED", paymentStatus: "FAILED" } });
  });

  // Restocking can flip a sold-out/preorder badge back — invalidate every affected product.
  if (restockedProductIds.size > 0) {
    const products = await db.product.findMany({ where: { id: { in: [...restockedProductIds] } }, select: { id: true, slug: true } });
    for (const p of products) invalidateProduct({ id: p.id, slug: p.slug });
  }
}
