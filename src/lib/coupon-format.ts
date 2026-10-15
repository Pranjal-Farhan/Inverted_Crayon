import { formatTaka } from "@/lib/money";

/** Client-safe coupon display helpers — no database access, importable from any component. The
 * pricing/validation rules themselves live in src/lib/coupon.ts (server only). */

export type CouponType = "PERCENT" | "FIXED" | "FREE_SHIPPING";

export function couponBenefitLabel(c: { type: CouponType; value: number; maxDiscountAmount: number | null }): string {
  if (c.type === "FREE_SHIPPING") return "Free delivery";
  if (c.type === "FIXED") return `${formatTaka(c.value)} off`;
  return `${c.value}% off${c.maxDiscountAmount != null ? ` · up to ${formatTaka(c.maxDiscountAmount)}` : ""}`;
}

export type CouponStatus = "ACTIVE" | "SCHEDULED" | "EXPIRED" | "USED_UP" | "INACTIVE";

export const COUPON_STATUS_LABEL: Record<CouponStatus, string> = {
  ACTIVE: "Active",
  SCHEDULED: "Scheduled",
  EXPIRED: "Expired",
  USED_UP: "Used up",
  INACTIVE: "Inactive",
};

/** The one definition of "is this coupon usable right now", so the admin list, the product
 * editor's picker and the storefront's checkout checks never disagree about it. */
export function couponStatus(
  c: {
    active: boolean;
    startsAt: Date | string | null;
    endsAt: Date | string | null;
    usageLimit: number | null;
    usedCount: number;
  },
  now: Date = new Date(),
): CouponStatus {
  if (!c.active) return "INACTIVE";
  if (c.endsAt && new Date(c.endsAt) < now) return "EXPIRED";
  if (c.startsAt && new Date(c.startsAt) > now) return "SCHEDULED";
  if (c.usageLimit != null && c.usedCount >= c.usageLimit) return "USED_UP";
  return "ACTIVE";
}
