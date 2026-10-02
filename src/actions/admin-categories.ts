"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getAdminSession } from "@/lib/session";
import { slugify } from "@/lib/slugify";

async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) throw new Error("Not authorized.");
}

const GENDER_LABEL: Record<"MEN" | "WOMEN" | "UNISEX", string> = {
  MEN: "Men",
  WOMEN: "Women",
  UNISEX: "Unisex",
};

function revalidateStorefront() {
  revalidatePath("/admin/categories");
  revalidatePath("/admin/products/new");
  revalidatePath("/");
  revalidatePath("/men");
  revalidatePath("/women");
}

/**
 * A Unisex subcategory is browsable from every branch — if it doesn't already have a
 * same-name/slug sibling under Men and Women, create one. Products never move: a Unisex
 * product keeps its single categoryId, and shows up under the mirrored Men/Women branch at
 * query time by matching gender + slug (see getPLPResults in src/lib/plp.ts). This just keeps
 * the taxonomy itself (header dropdowns, the admin's subcategory picker) consistent across
 * branches so "Jeans" is selectable/visible everywhere a Unisex Jeans product would surface.
 */
export async function ensureMirrorCategories(name: string, slug: string) {
  for (const gender of ["MEN", "WOMEN"] as const) {
    const existing = await db.category.findFirst({ where: { gender, slug } });
    if (existing) continue;
    const maxPosition = await db.category.aggregate({ where: { gender }, _max: { position: true } });
    await db.category.create({
      data: { name, slug, gender, position: (maxPosition._max.position ?? -1) + 1 },
    });
  }
}

const createSchema = z.object({
  gender: z.enum(["MEN", "WOMEN", "UNISEX"]),
  name: z.string().trim().min(1, "Enter a category name.").max(40, "Keep it under 40 characters."),
});

export type CategoryActionResult = { ok: true } | { ok: false; error: string };

export async function createCategory(input: z.infer<typeof createSchema>): Promise<CategoryActionResult> {
  await requireAdmin();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid category." };
  const data = parsed.data;

  const slug = slugify(data.name);
  if (!slug) return { ok: false, error: "Enter a valid category name." };

  const existing = await db.category.findFirst({ where: { gender: data.gender, slug } });
  if (existing) {
    return { ok: false, error: `"${existing.name}" already exists under ${GENDER_LABEL[data.gender]}.` };
  }

  const maxPosition = await db.category.aggregate({ where: { gender: data.gender }, _max: { position: true } });
  await db.category.create({
    data: { name: data.name.trim(), slug, gender: data.gender, position: (maxPosition._max.position ?? -1) + 1 },
  });

  if (data.gender === "UNISEX") {
    await ensureMirrorCategories(data.name.trim(), slug);
  }

  revalidateStorefront();
  return { ok: true };
}

export async function deleteCategory(id: string): Promise<CategoryActionResult> {
  await requireAdmin();
  const productCount = await db.product.count({ where: { categoryId: id } });
  if (productCount > 0) {
    return {
      ok: false,
      error: `${productCount} product${productCount === 1 ? "" : "s"} still use this category — move them first.`,
    };
  }
  await db.category.delete({ where: { id } });
  revalidateStorefront();
  return { ok: true };
}
