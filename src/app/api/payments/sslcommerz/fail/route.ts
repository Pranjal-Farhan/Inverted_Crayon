import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { restockAndCancelOrder } from "@/lib/payments/rollback";

export async function POST(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const form = await req.formData();
  const tranId = form.get("tran_id")?.toString();
  const order = tranId ? await db.order.findUnique({ where: { number: tranId } }) : null;
  if (order) await restockAndCancelOrder(order.id);
  return NextResponse.redirect(`${origin}/checkout?payment=failed`);
}
