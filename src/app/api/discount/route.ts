import { NextResponse } from "next/server";
import { z } from "zod";
import { evaluateCoupon, isFirstOrder, priceCartLines } from "@/lib/coupon";
import { getCustomerSession } from "@/lib/session";

// Lines, not a subtotal: whether a product-locked coupon applies depends on *which* products are
// in the bag, and the amounts are priced here from the variants themselves — the client's own
// numbers are never trusted (placeOrder re-evaluates everything at order time regardless).
const schema = z.object({
  code: z.string().min(1).max(64),
  lines: z
    .array(z.object({ variantId: z.string().min(1), qty: z.number().int().positive() }))
    .min(1)
    .max(100),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, kind: "INVALID", reason: "Invalid request." }, { status: 400 });
  }

  const pricing = await priceCartLines(parsed.data.lines);
  if (!pricing) {
    return NextResponse.json({
      ok: false,
      kind: "UNAVAILABLE",
      reason: "Something in your bag is no longer available.",
    });
  }

  // Guests can't be matched to an order history here (that would let anyone probe whether an
  // email has ordered before), so a first-order-only coupon is optimistically allowed for them —
  // placeOrder enforces it for real, by email, when the order is actually placed.
  const session = await getCustomerSession();
  const result = await evaluateCoupon({
    code: parsed.data.code,
    lines: pricing.priced,
    isFirstOrder: await isFirstOrder(session?.customerId),
  });
  if (!result.ok) return NextResponse.json(result);

  const { coupon } = result;
  return NextResponse.json({
    ok: true,
    code: coupon.code,
    type: coupon.type,
    value: Number(coupon.value),
    maxDiscountAmount: coupon.maxDiscountAmount != null ? Number(coupon.maxDiscountAmount) : null,
    scope: coupon.scope,
    itemDiscount: result.itemDiscount,
    freeShipping: result.freeShipping,
    capApplied: result.capApplied,
  });
}
