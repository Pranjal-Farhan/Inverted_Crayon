import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { executeBkashPayment } from "@/lib/payments/bkash";
import { restockAndCancelOrder } from "@/lib/payments/rollback";
import { notifyOrderPlaced } from "@/lib/notifications";

// bKash redirects the customer's browser back here with ?paymentID=...&status=success|failure|cancel
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const paymentID = req.nextUrl.searchParams.get("paymentID");
  const status = req.nextUrl.searchParams.get("status");

  if (!paymentID) return NextResponse.redirect(`${origin}/checkout?payment=error`);

  const order = await db.order.findFirst({ where: { paymentTransactionId: paymentID } });
  if (!order) return NextResponse.redirect(`${origin}/checkout?payment=error`);

  if (status !== "success") {
    await restockAndCancelOrder(order.id);
    return NextResponse.redirect(`${origin}/checkout?payment=${status === "cancel" ? "cancelled" : "failed"}`);
  }

  const result = await executeBkashPayment(paymentID);
  if (!result.ok) {
    await restockAndCancelOrder(order.id);
    return NextResponse.redirect(`${origin}/checkout?payment=failed`);
  }

  await db.order.update({ where: { id: order.id }, data: { paymentStatus: "PAID", status: "PAID" } });

  // Payment cleared — now the order counts as placed: customer email + SMS, and the brand's new-order email.
  await notifyOrderPlaced(order.number);

  return NextResponse.redirect(`${origin}/order/${order.number}`);
}
