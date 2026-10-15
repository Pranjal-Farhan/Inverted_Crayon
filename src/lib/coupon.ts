import "server-only";
import { db } from "@/lib/db";
import { formatTaka, toNumber } from "@/lib/money";
import { variantUnitPrice } from "@/lib/product-view";
import type { Discount, Prisma } from "@/generated/prisma/client";

/**
 * Coupon rules, in one place. The checkout page's live check (POST /api/discount) and the
 * authoritative placeOrder() both go through evaluateCoupon() with lines priced by the same
 * variantUnitPrice() rule, so the amount a customer sees before paying is the amount charged.
 *
 * Model in short: one coupon per order; a coupon is GLOBAL (every product) or PRODUCT-locked (only
 * products the admin attached in the product editor); the same customer can use a code any number
 * of times — only the coupon's shared usageLimit counter (usedCount) ever runs out; coupons apply
 * equally to in-stock and preorder lines (stock state never enters into it).
 */

/** The two messages the storefront shows verbatim — see CouponFailure.kind. */
export const COUPON_INVALID_MESSAGE = "Invalid coupon entered.";
export const COUPON_NOT_FOR_PRODUCT_MESSAGE = "This coupon is not available for this product, try a different one.";

export type CouponLine = { productId: string; lineTotal: number };

export type CouponFailure = {
  ok: false;
  /** INVALID: no such (live) code. NOT_FOR_PRODUCT: a real product-locked coupon, but nothing in
   * the cart is on its list. UNAVAILABLE: a real coupon that can't be used right now (expired,
   * used up, minimum spend, first-order-only) — `reason` says which. */
  kind: "INVALID" | "NOT_FOR_PRODUCT" | "UNAVAILABLE";
  reason: string;
};

export type CouponSuccess = {
  ok: true;
  coupon: Discount;
  /** Taka taken off the items (0 for a free-delivery coupon). */
  itemDiscount: number;
  /** The delivery charge is waived. */
  freeShipping: boolean;
  /** A percentage coupon hit its maximum-discount ceiling. */
  capApplied: boolean;
};

export type CouponEvaluation = CouponSuccess | CouponFailure;

const round2 = (n: number) => Math.round(n * 100) / 100;

const fail = (kind: CouponFailure["kind"], reason: string): CouponFailure => ({ ok: false, kind, reason });

export async function evaluateCoupon(input: {
  code: string;
  lines: CouponLine[];
  isFirstOrder: boolean;
  now?: Date;
}): Promise<CouponEvaluation> {
  const now = input.now ?? new Date();
  const code = input.code.trim().toUpperCase();
  if (!code) return fail("INVALID", COUPON_INVALID_MESSAGE);

  const productIds = [...new Set(input.lines.map((l) => l.productId))];
  const coupon = await db.discount.findUnique({
    where: { code },
    // Only the cart's own products that this coupon is attached to — all the scope check needs.
    include: { products: { where: { id: { in: productIds } }, select: { id: true } } },
  });
  // A switched-off coupon is indistinguishable from one that never existed.
  if (!coupon || !coupon.active) return fail("INVALID", COUPON_INVALID_MESSAGE);

  if (coupon.startsAt && coupon.startsAt > now) return fail("UNAVAILABLE", "That coupon isn't live yet.");
  if (coupon.endsAt && coupon.endsAt < now) return fail("UNAVAILABLE", "That coupon has expired.");
  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
    return fail("UNAVAILABLE", "That coupon has been fully redeemed.");
  }

  let eligible = input.lines;
  if (coupon.scope === "PRODUCT") {
    const attached = new Set(coupon.products.map((p) => p.id));
    eligible = input.lines.filter((l) => attached.has(l.productId));
    if (eligible.length === 0) return fail("NOT_FOR_PRODUCT", COUPON_NOT_FOR_PRODUCT_MESSAGE);
  }

  if (coupon.firstOrderOnly && !input.isFirstOrder) return fail("UNAVAILABLE", "That coupon is for first orders only.");

  // Measured on the items the coupon actually applies to — for a product-locked coupon that's just
  // the attached products, so a big unrelated item can't unlock a discount on a small eligible one.
  const eligibleSubtotal = round2(eligible.reduce((s, l) => s + l.lineTotal, 0));
  const minSpend = coupon.minSpend != null ? toNumber(coupon.minSpend) : 0;
  if (eligibleSubtotal < minSpend) {
    return fail(
      "UNAVAILABLE",
      `Spend at least ${formatTaka(minSpend)}${coupon.scope === "PRODUCT" ? " on eligible items" : ""} to use this coupon.`,
    );
  }

  const value = toNumber(coupon.value);
  let itemDiscount = 0;
  let capApplied = false;
  if (coupon.type === "PERCENT") {
    itemDiscount = round2((eligibleSubtotal * value) / 100);
    const cap = coupon.maxDiscountAmount != null ? toNumber(coupon.maxDiscountAmount) : null;
    if (cap != null && itemDiscount > cap) {
      itemDiscount = cap;
      capApplied = true;
    }
  } else if (coupon.type === "FIXED") {
    itemDiscount = Math.min(value, eligibleSubtotal);
  }

  return { ok: true, coupon, itemDiscount, freeShipping: coupon.type === "FREE_SHIPPING", capApplied };
}

/** Prices cart lines exactly as placeOrder will charge them. Null when a variant no longer exists. */
export async function priceCartLines(
  lines: { variantId: string; qty: number }[],
  now: Date = new Date(),
): Promise<{ priced: CouponLine[]; subtotal: number } | null> {
  const variants = await db.variant.findMany({
    where: { id: { in: lines.map((l) => l.variantId) } },
    include: { product: true },
  });
  const byId = new Map(variants.map((v) => [v.id, v]));
  const campaigns = await db.campaign.findMany({
    where: { active: true, startsAt: { lte: now }, endsAt: { gte: now } },
  });

  const priced: CouponLine[] = [];
  for (const line of lines) {
    const variant = byId.get(line.variantId);
    if (!variant) return null;
    priced.push({
      productId: variant.productId,
      lineTotal: round2(variantUnitPrice(variant, variant.product, campaigns, now) * line.qty),
    });
  }
  return { priced, subtotal: round2(priced.reduce((s, l) => s + l.lineTotal, 0)) };
}

/** Whether this shopper has no previous order — by account when logged in, else by email. */
export async function isFirstOrder(customerId: string | null | undefined, email?: string | null): Promise<boolean> {
  if (customerId) return (await db.order.count({ where: { customerId } })) === 0;
  if (email) return (await db.order.count({ where: { email } })) === 0;
  return true;
}

/**
 * Atomically claims one use of a coupon inside the order transaction. The guarded update is what
 * makes the global counter safe: two checkouts racing for the last remaining use can't both win,
 * since only one `usedCount < usageLimit` write can still match. Returns false when the budget ran
 * out (or the coupon was switched off) between validation and now.
 */
export async function claimCouponUse(
  tx: Prisma.TransactionClient,
  coupon: Pick<Discount, "id" | "usageLimit">,
): Promise<boolean> {
  const claimed = await tx.discount.updateMany({
    where: {
      id: coupon.id,
      active: true,
      ...(coupon.usageLimit != null ? { usedCount: { lt: coupon.usageLimit } } : {}),
    },
    data: { usedCount: { increment: 1 } },
  });
  return claimed.count > 0;
}

/** Gives a coupon use back — only for an order that never really happened (a gateway payment that
 * failed after the order was created). An admin cancelling or refunding a real order deliberately
 * does not call this: that use was genuinely spent. */
export async function releaseCouponForOrder(tx: Prisma.TransactionClient, order: { id: string; discountCode: string | null }) {
  const redemption = await tx.discountRedemption.findUnique({ where: { orderId: order.id } });
  if (redemption) {
    await tx.discount.update({ where: { id: redemption.discountId }, data: { usedCount: { decrement: 1 } } });
    await tx.discountRedemption.delete({ where: { id: redemption.id } });
  } else if (order.discountCode) {
    // Order predates the usage ledger — fall back to the code the order was stamped with.
    await tx.discount.updateMany({ where: { code: order.discountCode }, data: { usedCount: { decrement: 1 } } });
  }
}
