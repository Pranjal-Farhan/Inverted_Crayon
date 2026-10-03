"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { getAdminSession } from "@/lib/session";
import { slugify } from "@/lib/slugify";
import { uploadToImgBb } from "@/lib/imgbb";

function isUniqueConstraintError(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

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
    try {
      await db.category.create({
        data: { name, slug, gender, position: (maxPosition._max.position ?? -1) + 1 },
      });
    } catch (e) {
      // Two saves racing to mirror the same category at once can both pass the check above —
      // whichever loses the create to the unique (gender, slug) constraint just means the other
      // one already finished the job, which is exactly what this function is trying to ensure.
      if (!isUniqueConstraintError(e)) throw e;
    }
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
  try {
    await db.category.create({
      data: { name: data.name.trim(), slug, gender: data.gender, position: (maxPosition._max.position ?? -1) + 1 },
    });
  } catch (e) {
    // Two submits of the same name/branch racing past the findFirst check above both try to
    // create — the one that loses to the unique constraint gets the same friendly message the
    // check above would have given it if it had just lost the race by a few milliseconds less.
    if (isUniqueConstraintError(e)) {
      return { ok: false, error: `"${data.name.trim()}" already exists under ${GENDER_LABEL[data.gender]}.` };
    }
    throw e;
  }

  if (data.gender === "UNISEX") {
    await ensureMirrorCategories(data.name.trim(), slug);
  }

  revalidateStorefront();
  return { ok: true };
}

const MAX_CATEGORY_IMAGE_BYTES = 8 * 1024 * 1024;
const REJECTED_CATEGORY_IMAGE_TYPES = new Set(["image/svg+xml"]);

export type SetCategoryImageResult = { ok: true; url: string } | { ok: false; error: string };

/**
 * The tile/card image shown for this category — the homepage's "Shop by category" spotlight,
 * the gender-hub category grid (§GenderHub.tsx), and eventually any other category tile all
 * read the same field, so uploading it once here updates every one of them.
 */
export async function setCategoryImage(categoryId: string, formData: FormData): Promise<SetCategoryImageResult> {
  await requireAdmin();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "No file received." };
  if (file.size > MAX_CATEGORY_IMAGE_BYTES) return { ok: false, error: "Image must be under 8MB." };
  if (!file.type.startsWith("image/") || REJECTED_CATEGORY_IMAGE_TYPES.has(file.type)) {
    return { ok: false, error: "Only JPG, PNG, WEBP, GIF or AVIF images are accepted." };
  }

  let url: string;
  try {
    url = await uploadToImgBb(file);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Image upload failed." };
  }

  await db.category.update({ where: { id: categoryId }, data: { imageUrl: url } });
  revalidateStorefront();
  return { ok: true, url };
}

export async function removeCategoryImage(categoryId: string): Promise<CategoryActionResult> {
  await requireAdmin();
  await db.category.update({ where: { id: categoryId }, data: { imageUrl: null } });
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
