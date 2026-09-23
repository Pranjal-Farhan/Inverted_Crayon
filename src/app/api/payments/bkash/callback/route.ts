import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { executeBkashPayment } from "@/lib/payments/bkash";
import { restockAndCancelOrder } from "@/lib/payments/rollback";
import { sendMail } from "@/lib/mail";
import { formatTaka, toNumber } from "@/lib/money";

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

  await sendMail({
    to: order.email,
    subject: "Order confirmed",
    body: `Order #${order.number} confirmed — ${formatTaka(toNumber(order.advanceAmount))}${
      toNumber(order.balanceDue) > 0 ? ` now, ${formatTaka(toNumber(order.balanceDue))} due on delivery` : ""
    }. We'll email you when it ships.`,
    type: "ORDER_CONFIRMED",
    relatedOrderId: order.number,
  }).catch((e) => console.error("order-confirmation email failed", e));

  return NextResponse.redirect(`${origin}/order/${order.number}`);
}
