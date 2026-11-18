import "server-only";
import type { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { querySslcommerzTransactionStatuses, sslcommerzConfigured, sslcommerzSaysUnpaid } from "@/lib/payments/sslcommerz";
import { MAX_GATEWAY_ID_LENGTH, redirectShopper } from "@/lib/payments/returns";
import { cancelUnpaidGatewayOrder } from "@/lib/payments/settle";

type PendingCheck = { id: string; number: string; status: string; paymentStatus: string };

/**
 * Cancels an SSLCommerz order (restock, release its coupon) only when SSLCommerz itself, asked
 * server-to-server, records the order's payment as failed or cancelled and never as paid. The return
 * URLs are public and the tran_id they carry is just an order number, so a request to them proves
 * nothing on its own. Asks twice, a moment apart, in case the gateway's record trails its redirect.
 */
export async function cancelIfSslcommerzSaysUnpaid(order: PendingCheck): Promise<boolean> {
  if (order.status !== "PENDING" || order.paymentStatus !== "PENDING") return false;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 1500));
    const statuses = await querySslcommerzTransactionStatuses(order.number);
    if (statuses && sslcommerzSaysUnpaid(statuses)) return cancelUnpaidGatewayOrder(order.id, "SSLCOMMERZ");
  }
  return false;
}

/** The fail and cancel return URLs: the same handling, a different message for the shopper. */
export async function handleSslcommerzUnpaidReturn(req: NextRequest, outcome: "failed" | "cancelled"): Promise<NextResponse> {
  if (!sslcommerzConfigured()) return redirectShopper(req, "/checkout?payment=error");

  const form = await req.formData().catch(() => null);
  const tranId = form?.get("tran_id")?.toString();
  const order =
    tranId && tranId.length <= MAX_GATEWAY_ID_LENGTH
      ? await db.order.findFirst({
          where: { number: tranId, paymentMethod: "SSLCOMMERZ" },
          select: { id: true, number: true, status: true, paymentStatus: true },
        })
      : null;

  if (order && order.status === "PENDING" && order.paymentStatus === "PENDING" && !(await cancelIfSslcommerzSaysUnpaid(order))) {
    // The gateway doesn't (yet) record this payment as failed: leave the order waiting rather than
    // trust the request. An admin can cancel it from Orders if it never gets paid.
    console.warn(`[sslcommerz] ${outcome} return for ${order.number} isn't backed by the gateway's record — order left pending`);
  }
  return redirectShopper(req, `/checkout?payment=${outcome}`);
}
