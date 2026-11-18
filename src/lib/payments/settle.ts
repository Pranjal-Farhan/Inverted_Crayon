import "server-only";
import { db } from "@/lib/db";
import { releaseCouponForOrder } from "@/lib/coupon";
import { notifyOrderPlaced } from "@/lib/notifications";
import { afterStockChanged, changeStock, type StockChange } from "@/lib/stock";

export type GatewayMethod = "BKASH" | "SSLCOMMERZ";

/**
 * The only states a payment-gateway callback may move an order out of: paid through that gateway
 * and still waiting for the money (order and payment both PENDING). Callback URLs are public — anyone
 * can call them with any order number or payment id — so a COD order, an order already paid, shipped
 * or cancelled, or one handled by an earlier callback must never be touched by one.
 */
const awaitingPayment = (orderId: string, method: GatewayMethod) => ({
  id: orderId,
  paymentMethod: method,
  status: "PENDING" as const,
  paymentStatus: "PENDING" as const,
});

/** Same money, allowing for the gateway reporting "500.00" against our 500. */
export function amountsMatch(a: number, b: number): boolean {
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 0.01;
}

/**
 * Marks an order paid once its gateway has confirmed the payment server-to-server. Atomic claim: a
 * second callback for the same order (a refresh, a retry) finds it already settled and returns false,
 * so the confirmation emails go out once.
 */
export async function markGatewayOrderPaid(orderId: string, method: GatewayMethod, paymentTransactionId?: string): Promise<boolean> {
  const claimed = await db.order.updateMany({
    where: awaitingPayment(orderId, method),
    data: { status: "PAID", paymentStatus: "PAID", ...(paymentTransactionId ? { paymentTransactionId } : {}) },
  });
  return claimed.count === 1;
}

/**
 * A payment the gateway has confirmed server-to-server, for this order and what it owes: mark the
 * order paid and send the order-placed emails (once). Returns the page to send the shopper to.
 */
export async function settleConfirmedPayment(
  order: { id: string; number: string },
  method: GatewayMethod,
  paymentTransactionId?: string,
): Promise<string> {
  if (await markGatewayOrderPaid(order.id, method, paymentTransactionId)) {
    // Payment cleared — now the order counts as placed: customer email, and the brand's new-order email.
    await notifyOrderPlaced(order.number);
    return `/order/${order.number}`;
  }
  const now = await db.order.findUnique({ where: { id: order.id }, select: { status: true, paymentStatus: true } });
  if (now?.paymentStatus === "PAID") return `/order/${order.number}`; // an earlier callback settled it
  // The money arrived, but the order had already stopped waiting for it (cancelled meanwhile) — a
  // person has to refund it or bring the order back, so say so loudly where it'll be seen.
  console.error(
    `[payments] ${method} payment for order ${order.number} went through, but the order is ${now?.status}/${now?.paymentStatus} — refund it or restore the order by hand.`,
  );
  return "/checkout?payment=review";
}

/**
 * Cancels an order whose online payment failed, was cancelled or couldn't be started: puts its stock
 * back and releases its coupon. Only an order still awaiting payment through `method` is touched
 * (see awaitingPayment); returns whether this call was the one that cancelled it.
 */
export async function cancelUnpaidGatewayOrder(orderId: string, method: GatewayMethod): Promise<boolean> {
  const changes: StockChange[] = [];
  let cancelled = false;

  await db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order) return;
    // Atomic claim: when the gateway calls back twice (fail + cancel, or a retry), only one of them
    // wins the CANCELLED transition and restocks — the other finds it already claimed and stops.
    const claimed = await tx.order.updateMany({
      where: awaitingPayment(orderId, method),
      data: { status: "CANCELLED", paymentStatus: "FAILED" },
    });
    if (claimed.count === 0) return;
    cancelled = true;

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
  return cancelled;
}
