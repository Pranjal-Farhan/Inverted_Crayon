import "server-only";
import { db } from "@/lib/db";
import { toNumber } from "@/lib/money";
import { couponBenefitLabel, couponStatus, type CouponStatus } from "@/lib/coupon-format";

/** A product-locked coupon as the product editor's picker shows it. */
export type CouponOption = { id: string; code: string; benefit: string; status: CouponStatus };

/** Every product-locked coupon (global ones work everywhere and never need attaching), newest
 * first — inactive and expired ones included, so an admin can see why a coupon they attached isn't
 * currently live instead of it silently vanishing from the list. */
export async function getProductLockedCouponOptions(): Promise<CouponOption[]> {
  const coupons = await db.discount.findMany({ where: { scope: "PRODUCT" }, orderBy: { createdAt: "desc" } });
  const now = new Date();
  return coupons.map((c) => ({
    id: c.id,
    code: c.code,
    benefit: couponBenefitLabel({
      type: c.type,
      value: toNumber(c.value),
      maxDiscountAmount: c.maxDiscountAmount != null ? toNumber(c.maxDiscountAmount) : null,
    }),
    status: couponStatus(c, now),
  }));
}
