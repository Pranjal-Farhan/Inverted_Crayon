"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
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

export async function saveDiscount(input: z.infer<typeof schema>) {
  await requireAdmin();
  const data = schema.parse(input);
  await db.discount.upsert({
    where: { id: data.id ?? "__new__" },
    update: { ...data, code: data.code.toUpperCase() },
    create: { ...data, code: data.code.toUpperCase() },
  });
  revalidatePath("/admin/discounts");
}

export async function deleteDiscount(id: string) {
  await requireAdmin();
  await db.discount.delete({ where: { id } });
  revalidatePath("/admin/discounts");
}
