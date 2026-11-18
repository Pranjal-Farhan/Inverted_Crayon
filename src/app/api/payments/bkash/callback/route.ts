import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { toNumber } from "@/lib/money";
import { bkashConfigured, executeBkashPayment, queryBkashPayment } from "@/lib/payments/bkash";
import { amountsMatch, cancelUnpaidGatewayOrder, settleConfirmedPayment } from "@/lib/payments/settle";
import { MAX_GATEWAY_ID_LENGTH, redirectShopper } from "@/lib/payments/returns";

// bKash sends the shopper's browser back here: ?paymentID=…&status=success|failure|cancel. That is just
// a URL — anyone holding it can open it again or change its status — so the status is only a hint.
// Money moves only when this server executes the payment with bKash, the order is marked paid only for
// a completed payment of exactly what it owes, and every change is guarded on the order still waiting
// for its payment, so replaying the URL can't cancel a paid order or put its stock back twice.
export async function GET(req: NextRequest) {
  if (!bkashConfigured()) return redirectShopper(req, "/checkout?payment=error");
  const paymentID = req.nextUrl.searchParams.get("paymentID");
  const status = req.nextUrl.searchParams.get("status");
  if (!paymentID || paymentID.length > MAX_GATEWAY_ID_LENGTH) return redirectShopper(req, "/checkout?payment=error");

  const order = await db.order.findFirst({ where: { paymentTransactionId: paymentID, paymentMethod: "BKASH" } });
  if (!order) return redirectShopper(req, "/checkout?payment=error");
  if (order.paymentStatus === "PAID") return redirectShopper(req, `/order/${order.number}`); // a refresh after it settled
  if (order.status !== "PENDING" || order.paymentStatus !== "PENDING") return redirectShopper(req, "/checkout?payment=failed");

  const owed = toNumber(order.advanceAmount);
  const isForThisOrder = (p: { amount: number; merchantInvoiceNumber: string | null }) =>
    amountsMatch(p.amount, owed) && (p.merchantInvoiceNumber == null || p.merchantInvoiceNumber === order.number);
  const settleCompleted = async (p: { amount: number; merchantInvoiceNumber: string | null }) => {
    if (isForThisOrder(p)) return redirectShopper(req, await settleConfirmedPayment(order, "BKASH"));
    console.error(
      `[bkash] payment ${paymentID} completed for ${p.amount} (invoice ${p.merchantInvoiceNumber}), but order ${order.number} owes ${owed} — check it by hand`,
    );
    return redirectShopper(req, "/checkout?payment=review");
  };

  if (status === "success") {
    const executed = await executeBkashPayment(paymentID);
    if (executed.ok) return settleCompleted(executed);
  }

  // Not executed just now: the shopper cancelled or failed on bKash's page, or execute didn't go
  // through (or this URL is being opened again after an earlier execute). bKash's own record decides.
  const record = await queryBkashPayment(paymentID);
  if (record?.transactionStatus === "Completed") return settleCompleted(record);
  const unpaidOutcome = status === "cancel" ? "cancelled" : "failed";
  if (!record) {
    console.warn(`[bkash] couldn't ask bKash about payment ${paymentID} for ${order.number} — order left pending`);
    return redirectShopper(req, status === "success" ? "/checkout?payment=review" : `/checkout?payment=${unpaidOutcome}`);
  }
  // bKash has no completed payment for it, and only this server can complete one — so no money moved.
  // Give the order up: restock it and release its coupon.
  await cancelUnpaidGatewayOrder(order.id, "BKASH");
  return redirectShopper(req, `/checkout?payment=${unpaidOutcome}`);
}
