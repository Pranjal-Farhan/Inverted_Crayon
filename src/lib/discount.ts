import { db } from "@/lib/db";
import { toNumber } from "@/lib/money";
import type { Discount } from "@/generated/prisma/client";

export type DiscountResult =
  | { ok: true; discount: Discount; amount: number }
  | { ok: false; reason: string };

export async function validateDiscountCode(
  code: string,
  subtotal: number,
  isFirstOrder: boolean,
): Promise<DiscountResult> {
  const discount = await db.discount.findUnique({ where: { code: code.trim().toUpperCase() } });
  if (!discount || !discount.active) {
    return { ok: false, reason: "That code isn't valid." };
  }
  const now = new Date();
  if (discount.startsAt && discount.startsAt > now) {
    return { ok: false, reason: "That code isn't live yet." };
  }
  if (discount.endsAt && discount.endsAt < now) {
    return { ok: false, reason: "That code has expired." };
  }
  if (discount.usageLimit != null && discount.usedCount >= discount.usageLimit) {
    return { ok: false, reason: "That code has been fully redeemed." };
  }
  if (discount.firstOrderOnly && !isFirstOrder) {
    return { ok: false, reason: "That code is for first orders only." };
  }
  const minSpend = discount.minSpend != null ? toNumber(discount.minSpend) : 0;
  if (subtotal < minSpend) {
    return { ok: false, reason: `Add more to your bag — this code needs a minimum spend.` };
  }

  let amount = 0;
  if (discount.type === "PERCENT") {
    amount = Math.round(subtotal * (toNumber(discount.value) / 100) * 100) / 100;
  } else if (discount.type === "FIXED") {
    amount = Math.min(toNumber(discount.value), subtotal);
  } else if (discount.type === "FREE_SHIPPING") {
    amount = 0; // handled separately as shipping waiver
  }

  return { ok: true, discount, amount };
}
