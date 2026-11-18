import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { toNumber } from "@/lib/money";
import { sslcommerzConfigured, validateSslcommerzTransaction } from "@/lib/payments/sslcommerz";
import { amountsMatch, settleConfirmedPayment } from "@/lib/payments/settle";
import { MAX_GATEWAY_ID_LENGTH, redirectShopper } from "@/lib/payments/returns";
import { cancelIfSslcommerzSaysUnpaid } from "@/lib/payments/sslcommerz-returns";

// SSLCommerz sends the shopper back here (a form POST) after a payment. The URL is public and the form
// says whatever its sender likes, so none of it is believed: the val_id is checked with SSLCommerz
// server-to-server and must be a completed payment for this very order (our order number is the
// tran_id) in the currency and amount it owes. A val_id from some other, cheaper payment — or a
// made-up one — never marks an order paid, and never cancels one either.
export async function POST(req: NextRequest) {
  if (!sslcommerzConfigured()) return redirectShopper(req, "/checkout?payment=error");

  const form = await req.formData().catch(() => null);
  const tranId = form?.get("tran_id")?.toString();
  const valId = form?.get("val_id")?.toString();
  if (!tranId || !valId || tranId.length > MAX_GATEWAY_ID_LENGTH || valId.length > MAX_GATEWAY_ID_LENGTH) {
    return redirectShopper(req, "/checkout?payment=error");
  }

  const order = await db.order.findFirst({ where: { number: tranId, paymentMethod: "SSLCOMMERZ" } });
  if (!order) return redirectShopper(req, "/checkout?payment=error");
  if (order.paymentStatus === "PAID") return redirectShopper(req, `/order/${order.number}`); // a refresh after it settled

  const result = await validateSslcommerzTransaction(valId);
  const confirmed =
    result.ok &&
    result.tranId === order.number &&
    (result.currency === "" || result.currency === "BDT") &&
    amountsMatch(result.amount, toNumber(order.advanceAmount));
  if (confirmed) return redirectShopper(req, await settleConfirmedPayment(order, "SSLCOMMERZ", valId));

  console.warn(
    `[sslcommerz] success return for ${order.number} not confirmed by the gateway:`,
    result.ok ? `val_id is a payment of ${result.amount} ${result.currency} for ${result.tranId}` : result.reason,
  );
  // If SSLCommerz itself says this order's payment failed, tidy up as its fail return would; otherwise
  // leave the order as it is — the shopper may still be paying.
  if (await cancelIfSslcommerzSaysUnpaid(order)) return redirectShopper(req, "/checkout?payment=failed");
  return redirectShopper(req, "/checkout?payment=review");
}
