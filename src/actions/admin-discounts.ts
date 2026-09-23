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

const schema = z.object({
  id: z.string().optional(),
  code: z.string().min(2),
  type: z.enum(["PERCENT", "FIXED", "FREE_SHIPPING"]),
  value: z.number().min(0),
  minSpend: z.number().min(0).nullable().optional(),
  firstOrderOnly: z.boolean(),
  usageLimit: z.number().int().min(0).nullable().optional(),
  active: z.boolean(),
});

export type SaveDiscountResult = { ok: true } | { ok: false; error: string };

export async function saveDiscount(input: z.infer<typeof schema>): Promise<SaveDiscountResult> {
  await requireAdmin();
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "That code's details look invalid." };
  }
  const data = parsed.data;
  try {
    await db.discount.upsert({
      where: { id: data.id ?? "__new__" },
      update: { ...data, code: data.code.toUpperCase() },
      create: { ...data, code: data.code.toUpperCase() },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "That code already exists." };
    }
    console.error("saveDiscount failed", e);
    return { ok: false, error: "Couldn't save that code. Try again." };
  }
  revalidatePath("/admin/discounts");
  return { ok: true };
}

export async function deleteDiscount(id: string) {
  await requireAdmin();
  await db.discount.delete({ where: { id } }).catch((e) => {
    if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025")) throw e;
  });
  revalidatePath("/admin/discounts");
}
