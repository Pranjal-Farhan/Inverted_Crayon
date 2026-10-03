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

function isUniqueConstraintError(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

const sizeGuideDataSchema = z.object({
  columns: z.array(z.string().trim().min(1)).min(1).max(6),
  rows: z.array(z.object({ size: z.string().trim().min(1), values: z.array(z.string()) })).min(1),
});

const saveSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Enter a name.").max(60, "Keep it under 60 characters."),
  data: sizeGuideDataSchema,
});

export type SizeGuideTemplateActionResult = { ok: true } | { ok: false; error: string };

function revalidateAfterSave() {
  revalidatePath("/admin/size-guides");
  revalidatePath("/admin/products/new");
}

/** Creates a new reusable template (id omitted) or overwrites an existing one's name/table
 * (id provided) — one action for both since the form itself is the only caller and already
 * knows which case it's in. */
export async function saveSizeGuideTemplate(input: z.infer<typeof saveSchema>): Promise<SizeGuideTemplateActionResult> {
  await requireAdmin();
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid size guide." };
  const { id, name, data } = parsed.data;

  try {
    if (id) {
      await db.sizeGuideTemplate.update({ where: { id }, data: { name, data } });
    } else {
      await db.sizeGuideTemplate.create({ data: { name, data } });
    }
  } catch (e) {
    if (isUniqueConstraintError(e)) {
      return { ok: false, error: `A template named "${name}" already exists.` };
    }
    throw e;
  }

  revalidateAfterSave();
  return { ok: true };
}

export async function deleteSizeGuideTemplate(id: string): Promise<SizeGuideTemplateActionResult> {
  await requireAdmin();
  await db.sizeGuideTemplate.delete({ where: { id } });
  revalidateAfterSave();
  return { ok: true };
}
