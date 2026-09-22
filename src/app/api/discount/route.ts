import { NextResponse } from "next/server";
import { z } from "zod";
import { validateDiscountCode } from "@/lib/discount";
import { db } from "@/lib/db";
import { getCustomerSession } from "@/lib/session";

const schema = z.object({ code: z.string().min(1), subtotal: z.number().nonnegative() });

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, reason: "Invalid request." }, { status: 400 });
  }

  const session = await getCustomerSession();
  let isFirstOrder = true;
  if (session?.customerId) {
    const priorOrders = await db.order.count({ where: { customerId: session.customerId } });
    isFirstOrder = priorOrders === 0;
  }

  const result = await validateDiscountCode(parsed.data.code, parsed.data.subtotal, isFirstOrder);
  if (!result.ok) return NextResponse.json(result);

  return NextResponse.json({
    ok: true,
    amount: result.amount,
    type: result.discount.type,
    code: result.discount.code,
  });
}
