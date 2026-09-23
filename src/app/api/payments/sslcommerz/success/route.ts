import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateSslcommerzTransaction } from "@/lib/payments/sslcommerz";
import { restockAndCancelOrder } from "@/lib/payments/rollback";
import { sendMail } from "@/lib/mail";
import { formatTaka, toNumber } from "@/lib/money";

// SSLCommerz POSTs (application/x-www-form-urlencoded) back to this URL after a successful payment.
export async function POST(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const form = await req.formData();
  const tranId = form.get("tran_id")?.toString();
  const valId = form.get("val_id")?.toString();

  if (!tranId || !valId) return NextResponse.redirect(`${origin}/checkout?payment=error`);

  const order = await db.order.findUnique({ where: { number: tranId } });
  if (!order) return NextResponse.redirect(`${origin}/checkout?payment=error`);

  const result = await validateSslcommerzTransaction(valId);
  if (!result.ok) {
    await restockAndCancelOrder(order.id);
    return NextResponse.redirect(`${origin}/checkout?payment=failed`);
  }

  await db.order.update({
    where: { id: order.id },
    data: { paymentStatus: "PAID", status: "PAID", paymentTransactionId: valId },
  });

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
