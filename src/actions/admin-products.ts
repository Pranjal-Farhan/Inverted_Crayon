"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { getAdminSession } from "@/lib/session";
import { sendMail } from "@/lib/mail";
import { uploadToImgBb } from "@/lib/imgbb";
import { ensureMirrorCategories } from "@/actions/admin-categories";
import { slugify } from "@/lib/slugify";
import { APPAREL_SIZES, ONE_SIZE } from "@/lib/sizes";
import { MAX_SIZE_GUIDE_COLUMNS } from "@/lib/size-guide";

const VALID_SIZES = [...APPAREL_SIZES, ONE_SIZE] as [string, ...string[]];

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_FILES_PER_UPLOAD = 12;
const MAX_IMAGES_PER_PRODUCT = 20;
const MAX_TOTAL_UPLOAD_BYTES = 40 * 1024 * 1024;
// SVG is deliberately excluded even though it's an "image/*" type because it can embed scripts.
const REJECTED_IMAGE_TYPES = new Set(["image/svg+xml"]);

async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) throw new Error("Not authorized.");
  return session;
}

function randomToken(len: number, upper: boolean): string {
  const s = Math.random().toString(36).slice(2, 2 + len);
  return upper ? s.toUpperCase() : s;
}

/** The client already builds a title/size/color-derived SKU the instant a variant row is
 * created (ProductEditorForm.tsx) — this just sanitizes it defensively and re-verifies it's
 * actually unique against the database before it's ever written, appending a short random
 * suffix (and retrying) only if that exact value is already taken by some other variant.
 * Globally unique by schema, so even an admin reusing an identical title/size/color combo
 * across two different products can't collide. */
async function ensureUniqueSku(tx: Prisma.TransactionClient, candidate: string): Promise<string> {
  const base = candidate.trim().replace(/[^a-zA-Z0-9-]/g, "").toUpperCase().slice(0, 40) || "SKU";
  for (let attempt = 0; attempt < 5; attempt++) {
    const sku = attempt === 0 ? base : `${base}-${randomToken(4, true)}`;
    if (!(await tx.variant.findUnique({ where: { sku } }))) return sku;
  }
  return `${base}-${randomToken(8, true)}`;
}

/** Same idea as ensureUniqueSku, for Product.slug — re-slugifies the admin's intended slug
 * (defensive: the Slug field is free text, so this guarantees a URL-safe result no matter what
 * was typed into it) and appends a short random suffix only if that exact slug already belongs
 * to a *different* product. excludeId lets an already-saved product keep its own slug as a
 * non-collision against itself. */
async function ensureUniqueSlug(tx: Prisma.TransactionClient, candidate: string, excludeId: string | undefined): Promise<string> {
  const base = slugify(candidate) || "product";
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = attempt === 0 ? base : `${base}-${randomToken(4, false)}`;
    const existing = await tx.product.findUnique({ where: { slug }, select: { id: true } });
    if (!existing || existing.id === excludeId) return slug;
  }
  return `${base}-${randomToken(8, false)}`;
}

/** ensureUniqueSlug/ensureUniqueSku check-then-write inside their own transaction, which closes
 * the gap for a single save but not for two saves landing in the exact same instant — each
 * transaction's uniqueness check runs under Postgres's normal read-committed isolation, so it
 * can't see the other's still-uncommitted insert, and the slower one to commit hits a real
 * unique-constraint violation at that point. Retrying the whole transaction here (rather than
 * surfacing that as a failure) means the retry's checks now see the first transaction's
 * already-committed row and simply pick a different value — the admin never sees this happen. */
async function runWithUniqueRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      const isRace = e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
      if (!isRace || i === attempts - 1) throw e;
    }
  }
  // Unreachable — the loop above always either returns or throws on its last attempt.
  throw new Error("runWithUniqueRetry: exhausted attempts");
}

const variantSchema = z.object({
  id: z.string().optional(),
  // Only meaningful for a brand-new variant (no id yet) — the client generates an instant
  // title/size/color-derived preview the moment the row is created (ProductEditorForm.tsx);
  // the server re-verifies/disambiguates it (ensureUniqueSku) rather than trusting it outright.
  // Ignored entirely for an existing variant, whose real sku is left untouched on update.
  sku: z.string().trim().min(1, "SKU is required."),
  // The admin editor only ever generates a full color block from APPAREL_SIZES or [ONE_SIZE]
  // (ProductEditorForm.tsx's addColor()/backfillColorGroups()) — this is defense in depth, not
  // the primary guard, against any payload that didn't come from that UI.
  size: z.enum(VALID_SIZES, { message: "Size must be one of S, M, L, XL, XXL, XXXL, or One Size." }),
  color: z.string().trim().min(1, "Color is required."),
  colorHex: z.string().optional(),
  stockQty: z.number().int().min(0),
  lowStockThreshold: z.number().int().min(0).default(5),
  priceOverride: z.number().positive().nullable().optional(),
  preorderAdvanceAmount: z.number().min(0).nullable().optional(),
});

const productSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(2, "Title must be at least 2 characters."),
  slug: z.string().trim().min(2, "Slug must be at least 2 characters."),
  description: z.string().trim().min(1, "Description is required."),
  categoryId: z.string().min(1, "Select a category."),
  basePrice: z.number().positive(),
  status: z.enum(["DRAFT", "ACTIVE"]),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
  freeDelivery: z.enum(["NONE", "INSIDE_DHAKA", "NATIONWIDE"]).default("NONE"),
  tagNew: z.boolean().default(false),
  tagPreorder: z.boolean().default(false),
  preorderShipDate: z.string().optional(),
  tagLimited: z.boolean().default(false),
  tagBestseller: z.boolean().default(false),
  variants: z.array(variantSchema).min(1),
  sizeGuide: z
    .object({
      columns: z.array(z.string().trim().min(1)).min(1).max(MAX_SIZE_GUIDE_COLUMNS),
      rows: z.array(z.object({ size: z.string().trim().min(1), values: z.array(z.string()) })).min(1),
    })
    .nullable()
    .default(null),
}).superRefine((data, ctx) => {
  // Every color must carry exactly the sizes its own mode calls for — no fewer (an incomplete
  // block), no more (a duplicate), and never a mix of apparel sizes and "One Size" under one
  // color. The admin editor can't actually produce anything else (addColor()/backfillColorGroups()
  // always emit a complete, single-mode block), so this only ever fires against a payload that
  // didn't come from that UI.
  const byColor = new Map<string, string[]>();
  for (const v of data.variants) {
    const key = v.color.trim().toLowerCase();
    if (!byColor.has(key)) byColor.set(key, []);
    byColor.get(key)!.push(v.size);
  }
  for (const [colorKey, sizes] of byColor) {
    const isOneSize = sizes.includes(ONE_SIZE);
    const expected: readonly string[] = isOneSize ? [ONE_SIZE] : APPAREL_SIZES;
    const sizeSet = new Set(sizes);
    const matches = sizes.length === expected.length && sizeSet.size === expected.length && expected.every((s) => sizeSet.has(s));
    if (!matches) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: isOneSize
          ? `Color "${colorKey}" must have exactly one "One Size" variant.`
          : `Color "${colorKey}" must have all 6 sizes (S, M, L, XL, XXL, XXXL).`,
      });
    }
  }
});

export type ProductFormInput = z.infer<typeof productSchema>;
export type ProductSaveResult = { ok: true; id: string } | { ok: false; error: string };

function formatProductValidationError(issues: z.ZodIssue[]) {
  return issues
    .map((issue) => {
      const [field, index] = issue.path;
      if (field === "variants" && typeof index === "number") {
        const variantField = issue.path[2];
        const label = typeof variantField === "string" ? variantField.toUpperCase() : "VALUE";
        return `Variant ${index + 1} ${label}: ${issue.message}`;
      }
      return `${typeof field === "string" ? field : "Product"}: ${issue.message}`;
    })
    .join(" ");
}

export async function saveProduct(input: ProductFormInput): Promise<ProductSaveResult> {
  await requireAdmin();
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: formatProductValidationError(parsed.error.issues) };
  }
  const data = parsed.data;

  // Everything from here down — including the lookups before the transaction — is inside this
  // try block on purpose: any of them throwing uncaught (a transient DB hiccup, a race against
  // another concurrent save) used to escape saveProduct entirely, which the client's own
  // try/catch then surfaced as a silent no-op "Saving…" that just reset with no error message —
  // this is what made the Save button feel like it randomly failed. Now every path here either
  // returns a normal {ok:false, error} or really is an unexpected bug worth logging.
  try {
    const category = await db.category.findUnique({ where: { id: data.categoryId } });
    if (!category) return { ok: false, error: "Select a valid category." };
    // Self-healing: a Unisex category created before its Men/Women mirrors existed (or one
    // that predates this feature) gets them backfilled here too, not just at creation time.
    if (category.gender === "UNISEX") await ensureMirrorCategories(category.name, category.slug);

    const tags = await db.tag.findMany();
    const tagByType = Object.fromEntries(tags.map((t) => [t.type, t]));

    const existing = data.id
      ? await db.product.findUnique({
        where: { id: data.id },
        include: { tags: { include: { tag: true } }, variants: true },
      })
      : null;
    const existingVariants = existing?.variants ?? [];
    const variants = data.variants.map((variant) => {
      if (variant.id) return variant;
      const match = existingVariants.find((candidate) =>
        candidate.sku === variant.sku ||
        (candidate.size === variant.size && candidate.color === variant.color),
      );
      return match ? { ...variant, id: match.id } : variant;
    });
    const wasPreorderTag = existing?.tags.find((t) => t.tag.type === "PREORDER");
    const previousShipDate = (wasPreorderTag?.meta as { shipDate?: string } | null | undefined)?.shipDate;
    // Json? fields need the explicit JsonNull sentinel to clear them — plain `null` or `undefined`
    // would leave a previously-saved size guide in place instead of removing it.
    const sizeGuideValue = data.sizeGuide ?? Prisma.JsonNull;

    const product = await runWithUniqueRetry(() => db.$transaction(async (tx) => {
      // Checked and disambiguated fresh on every save, not just once at creation — two
      // different products titled the same thing, or a hand-edited slug that collides with
      // someone else's, both get a short random suffix appended instead of failing the save.
      const finalSlug = await ensureUniqueSlug(tx, data.slug, data.id);

      const productRecord = await tx.product.upsert({
        where: { id: data.id ?? "__new__" },
        update: {
          title: data.title,
          slug: finalSlug,
          description: data.description,
          gender: category.gender,
          categoryId: data.categoryId,
          basePrice: data.basePrice,
          status: data.status,
          seoTitle: data.seoTitle,
          seoDescription: data.seoDescription,
          freeDelivery: data.freeDelivery,
          sizeGuide: sizeGuideValue,
          // Only stamp publishedAt the first time a product goes live —
          // re-saving an already-active product must not re-trigger "New".
          publishedAt:
            data.status === "ACTIVE" ? (existing?.publishedAt ?? new Date()) : null,
        },
        create: {
          title: data.title,
          slug: finalSlug,
          description: data.description,
          gender: category.gender,
          categoryId: data.categoryId,
          basePrice: data.basePrice,
          status: data.status,
          seoTitle: data.seoTitle,
          seoDescription: data.seoDescription,
          freeDelivery: data.freeDelivery,
          sizeGuide: sizeGuideValue,
          publishedAt: data.status === "ACTIVE" ? new Date() : null,
        },
      });

      // variants: upsert provided, delete removed
      //
      // Every existing variant is parked on a temporary, per-variant-unique (size, color)
      // first, before any real value is written. Without this, two existing rows that swap
      // sizes (A: M→L, B: L→M — a perfectly valid *final* state, no duplicate anywhere) can
      // still fail: Postgres checks @@unique([productId, size, color]) immediately after each
      // UPDATE, not deferred to commit, so writing A's new size while B still holds the old one
      // collides mid-transaction even though nothing is actually wrong once both rows have
      // landed. `__tmp_<id>` is unique by construction (variant ids are unique and real
      // size/color values never contain one), so this first pass can never collide with
      // anything, vacating every slot before the real pass risks touching one that's still "in
      // use" by a row that hasn't been updated yet.
      for (const v of variants) {
        if (!v.id) continue;
        await tx.variant.update({
          where: { id: v.id },
          data: { size: `__tmp_${v.id}`, color: `__tmp_${v.id}` },
        });
      }

      const keepIds: string[] = [];
      for (const v of variants) {
        // Only new variants need their SKU verified (an existing one keeps whatever it
        // already has) — skip the uniqueness-check query entirely for updates.
        const newSku = v.id ? null : await ensureUniqueSku(tx, v.sku);
        const record = await tx.variant.upsert({
          where: { id: v.id ?? "__new__" },
          update: {
            // sku deliberately omitted — auto-generated once at creation (below) and left
            // alone after that, same reasoning as stockQty just below.
            size: v.size,
            color: v.color,
            colorHex: v.colorHex,
            // stockQty deliberately omitted: this form loads stock at page-open time, and a
            // customer purchase (or an inventory-page edit) between then and save would get
            // silently overwritten by that stale value. Stock changes go through the Inventory
            // page's setVariantStock instead; new variants still get their initial count below.
            lowStockThreshold: v.lowStockThreshold,
            priceOverride: v.priceOverride ?? null,
            preorderAdvanceAmount: v.preorderAdvanceAmount ?? null,
          },
          create: {
            productId: productRecord.id,
            // Prisma validates the shape of the whole upsert payload up front, including the
            // branch that won't actually run — for an existing variant (v.id set, newSku left
            // null above) this `create` object is dead code that never executes, but it still
            // has to satisfy the schema's non-null sku, so it falls back to the variant's own
            // already-real sku rather than literally writing null and failing validation.
            sku: newSku ?? v.sku,
            size: v.size,
            color: v.color,
            colorHex: v.colorHex,
            stockQty: v.stockQty,
            lowStockThreshold: v.lowStockThreshold,
            priceOverride: v.priceOverride ?? null,
            preorderAdvanceAmount: v.preorderAdvanceAmount ?? null,
          },
        });
        keepIds.push(record.id);
      }
      await tx.variant.deleteMany({ where: { productId: productRecord.id, id: { notIn: keepIds } } });

      // tags
      await tx.productTag.deleteMany({ where: { productId: productRecord.id } });
      const tagInserts: { type: string; enabled: boolean; meta?: Record<string, unknown> }[] = [
        { type: "NEW", enabled: data.tagNew },
        { type: "PREORDER", enabled: data.tagPreorder, meta: { shipDate: data.preorderShipDate } },
        { type: "LIMITED", enabled: data.tagLimited },
        { type: "BESTSELLER", enabled: data.tagBestseller },
      ];
      for (const t of tagInserts) {
        if (t.enabled && tagByType[t.type]) {
          await tx.productTag.create({
            data: { productId: productRecord.id, tagId: tagByType[t.type].id, meta: (t.meta ?? undefined) as never },
          });
        }
      }

      return productRecord;
    }, { timeout: 15000 }));

    if (data.tagPreorder && data.preorderShipDate && data.preorderShipDate !== previousShipDate) {
      const affected = await db.orderItem.findMany({
        where: {
          productId: product.id,
          isPreorder: true,
          order: { status: { in: ["PENDING", "PAID", "PROCESSING"] } },
        },
        include: { order: true },
      });
      const emails = [...new Set(affected.map((i) => i.order.email))];
      for (const to of emails) {
        await sendMail({
          to,
          subject: "Your preorder ships soon",
          body: `${product.title} now ships ${data.preorderShipDate}. We'll keep you posted if that changes.`,
          type: "PREORDER_SHIP_UPDATE",
        });
      }
    }

    revalidatePath("/admin/products");
    revalidatePath(`/admin/products/${product.id}`);
    return { ok: true, id: product.id };
  } catch (e) {
    // ensureUniqueSlug/ensureUniqueSku already resolve the overwhelming majority of collisions
    // before anything is written — this is the last-resort safety net for the sliver that can
    // still race past them (two saves landing on the exact same retried value in the same
    // instant), using Prisma's actual error code rather than sniffing the message text, which
    // varies across drivers/versions and silently stopped matching once before.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const target = Array.isArray(e.meta?.target) ? e.meta.target.join(", ") : String(e.meta?.target ?? "a field");
      return { ok: false, error: `That ${target} is already in use — try saving again.` };
    }
    console.error("saveProduct failed:", e);
    return { ok: false, error: "Something went wrong saving this product. Please try again." };
  }
}

export async function deleteProduct(id: string) {
  await requireAdmin();
  try {
    await db.product.delete({ where: { id } });
  } catch (e) {
    // P2025 = record already gone (double-submit) — deleting is idempotent, just continue.
    if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025")) throw e;
  }
  await fs.rm(path.join(process.cwd(), "public", "uploads", "products", id), { recursive: true, force: true });
  revalidatePath("/admin/products");
  redirect("/admin/products");
}

export type ProductImageRow = { id: string; url: string; alt: string | null; position: number; accentColor: string | null };
export type UploadImagesResult = { ok: true; images: ProductImageRow[] } | { ok: false; error: string };

export async function uploadProductImages(productId: string, formData: FormData): Promise<UploadImagesResult> {
  await requireAdmin();

  const product = await db.product.findUnique({ where: { id: productId }, select: { id: true, title: true } });
  if (!product) return { ok: false, error: "Product not found — save the product first." };

  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { ok: false, error: "No files received." };
  if (files.length > MAX_FILES_PER_UPLOAD) return { ok: false, error: `Upload at most ${MAX_FILES_PER_UPLOAD} images at a time.` };

  const oversized = files.some((f) => f.size > MAX_IMAGE_BYTES);
  if (oversized) return { ok: false, error: "Each image must be under 8MB." };

  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
  if (totalBytes > MAX_TOTAL_UPLOAD_BYTES) return { ok: false, error: "That's too much data in one upload — try fewer images." };

  const imageFiles = files.filter((f) => f.type.startsWith("image/") && !REJECTED_IMAGE_TYPES.has(f.type));
  if (imageFiles.length === 0) return { ok: false, error: "Only JPG, PNG, WEBP, GIF or AVIF images are accepted." };

  const position = await db.productImage.count({ where: { productId } });
  if (position + imageFiles.length > MAX_IMAGES_PER_PRODUCT) {
    return { ok: false, error: `A product can have at most ${MAX_IMAGES_PER_PRODUCT} images (${position} already uploaded).` };
  }

  let uploadedUrls: string[];
  try {
    uploadedUrls = await Promise.all(imageFiles.map((file) => uploadToImgBb(file)));
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Image upload failed." };
  }

  const created: ProductImageRow[] = [];
  for (const [index, url] of uploadedUrls.entries()) {
    try {
      const row = await db.productImage.create({
        data: { productId, url, alt: product.title, position: position + index },
      });
      created.push(row);
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Image upload failed." };
    }
  }

  revalidatePath(`/admin/products/${productId}`);
  revalidatePath("/admin/products");
  return { ok: true, images: created };
}

export async function deleteProductImage(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin();
  const image = await db.productImage.findUnique({ where: { id } });
  if (!image) return { ok: false, error: "Image not found." };

  await db.productImage.delete({ where: { id } });
  if (image.url.startsWith("/uploads/")) {
    await fs.unlink(path.join(process.cwd(), "public", image.url)).catch(() => { });
  }

  revalidatePath(`/admin/products/${image.productId}`);
  revalidatePath("/admin/products");
  return { ok: true };
}
