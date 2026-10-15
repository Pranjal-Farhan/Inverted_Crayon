"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { getAdminSession } from "@/lib/session";

async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) throw new Error("Not authorized.");
}

const schema = z
  .object({
    id: z.string().optional(),
    code: z
      .string()
      .trim()
      .min(2, "Enter a coupon code (at least 2 characters).")
      .max(40, "That code is too long.")
      .regex(/^[A-Za-z0-9_-]+$/, "Codes can only use letters, numbers, - and _."),
    type: z.enum(["PERCENT", "FIXED", "FREE_SHIPPING"]),
    value: z.number().finite().min(0),
    maxDiscountAmount: z.number().finite().positive("The maximum discount has to be more than 0.").nullable(),
    minSpend: z.number().finite().min(0).nullable(),
    firstOrderOnly: z.boolean(),
    // The coupon's shared budget across all customers — null means unlimited.
    usageLimit: z.number().int("Use a whole number of uses.").positive("The usage limit has to be at least 1.").nullable(),
    // ISO strings (the form converts the admin's local time) — null on both = no time limit.
    startsAt: z.iso.datetime().nullable(),
    endsAt: z.iso.datetime().nullable(),
    scope: z.enum(["GLOBAL", "PRODUCT"]),
    active: z.boolean(),
  })
  .superRefine((d, ctx) => {
    if (d.type === "PERCENT" && (d.value <= 0 || d.value > 100)) {
      ctx.addIssue({ code: "custom", path: ["value"], message: "A percentage has to be between 1 and 100." });
    }
    if (d.type === "FIXED" && d.value <= 0) {
      ctx.addIssue({ code: "custom", path: ["value"], message: "Enter the amount to take off, in tk." });
    }
    if (d.startsAt && d.endsAt && new Date(d.endsAt) <= new Date(d.startsAt)) {
      ctx.addIssue({ code: "custom", path: ["endsAt"], message: "The end time has to be after the start time." });
    }
  });

export type SaveDiscountInput = z.input<typeof schema>;
export type SaveDiscountResult = { ok: true } | { ok: false; error: string };

export async function saveDiscount(input: SaveDiscountInput): Promise<SaveDiscountResult> {
  await requireAdmin();
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "That coupon's details look invalid." };
  }
  const d = parsed.data;

  const payload = {
    code: d.code.toUpperCase(),
    type: d.type,
    // Fields that don't mean anything for this type are cleared rather than left to go stale.
    value: d.type === "FREE_SHIPPING" ? 0 : d.value,
    maxDiscountAmount: d.type === "PERCENT" ? d.maxDiscountAmount : null,
    minSpend: d.minSpend && d.minSpend > 0 ? d.minSpend : null,
    firstOrderOnly: d.firstOrderOnly,
    usageLimit: d.usageLimit,
    startsAt: d.startsAt ? new Date(d.startsAt) : null,
    endsAt: d.endsAt ? new Date(d.endsAt) : null,
    scope: d.scope,
    active: d.active,
  };

  try {
    if (d.id) {
      // usedCount is deliberately not in the payload — editing a coupon never resets its history.
      await db.discount.update({ where: { id: d.id }, data: payload });
    } else {
      await db.discount.create({ data: payload });
    }
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2002") return { ok: false, error: "That code already exists." };
      if (e.code === "P2025") return { ok: false, error: "That coupon no longer exists — refresh the page." };
    }
    console.error("saveDiscount failed", e);
    return { ok: false, error: "Couldn't save that coupon. Try again." };
  }
  revalidatePath("/admin/discounts");
  return { ok: true };
}

export async function setDiscountActive(id: string, active: boolean): Promise<SaveDiscountResult> {
  await requireAdmin();
  try {
    await db.discount.update({ where: { id }, data: { active } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return { ok: false, error: "That coupon no longer exists — refresh the page." };
    }
    throw e;
  }
  revalidatePath("/admin/discounts");
  return { ok: true };
}

/** Only a never-used coupon can be deleted: once orders have used it, its row is the history the
 * usage list is built from, so the answer there is to deactivate it instead. */
export async function deleteDiscount(id: string): Promise<SaveDiscountResult> {
  await requireAdmin();
  const coupon = await db.discount.findUnique({
    where: { id },
    select: { usedCount: true, _count: { select: { redemptions: true } } },
  });
  if (!coupon) return { ok: true };
  const uses = Math.max(coupon.usedCount, coupon._count.redemptions);
  if (uses > 0) {
    return {
      ok: false,
      error: `This coupon has been used ${uses} ${uses === 1 ? "time" : "times"} — deactivate it instead so its usage history is kept.`,
    };
  }
  await db.discount.delete({ where: { id } });
  revalidatePath("/admin/discounts");
  return { ok: true };
}
