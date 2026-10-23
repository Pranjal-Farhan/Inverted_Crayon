import "server-only";
import { db } from "@/lib/db";
import { releaseCouponForOrder } from "@/lib/coupon";
import { afterStockChanged, changeStock, type StockChange } from "@/lib/stock";

/** Used when a gateway payment fails/cancels/errors after the order (and its stock hold) was already created. */
export async function restockAndCancelOrder(orderId: string) {
  const changes: StockChange[] = [];

  await db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order) return;
    // Atomic claim: when the gateway calls back twice (fail + cancel, or a retry), only one of them
    // wins the CANCELLED transition and restocks — the other finds it already claimed and stops.
    const claimed = await tx.order.updateMany({ where: { id: orderId, status: { not: "CANCELLED" } }, data: { status: "CANCELLED", paymentStatus: "FAILED" } });
    if (claimed.count === 0) return;

    for (const item of order.items) {
      if (!item.isPreorder && item.variantId) {
        changes.push(
          await changeStock(tx, { variantId: item.variantId, delta: item.qty, reason: "ORDER_RESTORED", orderId, orderNumber: order.number, note: "Payment failed or was cancelled" }),
        );
      }
    }
    await releaseCouponForOrder(tx, order);
  });

  // Restocking can flip a sold-out/preorder badge back — refresh every affected product's pages.
  await afterStockChanged(changes);
}
