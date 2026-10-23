"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { requireAdminArea } from "@/lib/admin-guard";
import { canAccessArea } from "@/lib/admin-areas";
import { ensureMirrorCategories } from "@/actions/admin-categories";
import { slugify } from "@/lib/slugify";
import { APPAREL_SIZES, ONE_SIZE } from "@/lib/sizes";
import { MAX_SIZE_GUIDE_COLUMNS } from "@/lib/size-guide";
import { invalidateProduct } from "@/lib/invalidate";
import { recordOpening, recordRemoval } from "@/lib/stock";
import { describeError } from "@/lib/action-errors";

const VALID_SIZES = [...APPAREL_SIZES, ONE_SIZE] as [string, ...string[]];

async function requireAdmin() {
  return requireAdminArea("products");
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
  // The description is three sections on the product page. Mood is always required (it is also the
  // plain-text summary stored in Product.description); a product can only be published once all
  // three are filled in — see the superRefine below.
  mood: z.string().trim().min(1, "Mood is required — a line or two on the feel of the piece.").max(2000, "Mood is too long (2000 characters max)."),
  build: z.string().trim().max(2000, "Build is too long (2000 characters max).").default(""),
  howToWear: z.string().trim().max(2000, "How n when to wear is too long (2000 characters max).").default(""),
  categoryId: z.string().min(1, "Select a category."),
  basePrice: z.number().positive(),
  // What one unit costs the business (admin-only; Finance prices cost of goods from it). Left out =
  // "don't touch the saved value", null = clear it. Ignored entirely unless the signed-in account
  // may use Finance — see saveProduct.
  purchaseCost: z.number().min(0, "Purchase cost can't be negative.").max(10_000_000, "Purchase cost is too large.").nullable().optional(),
  // A standing markdown set directly on the product — null discountType means no discount (the
  // "off" state); when set, discountValue must be present too (enforced below, since zod can't
  // express "both or neither" with plain field types).
  discountType: z.enum(["PERCENT", "AMOUNT"]).nullable().default(null),
  discountValue: z.number().positive().nullable().default(null),
  status: z.enum(["DRAFT", "ACTIVE"]),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
  freeDelivery: z.enum(["NONE", "INSIDE_DHAKA", "NATIONWIDE"]).default("NONE"),
  // Per-product shipping override — null keeps the store's default rate for that zone.
  deliveryChargeInsideDhaka: z.number().min(0).nullable().default(null),
  deliveryChargeOutsideDhaka: z.number().min(0).nullable().default(null),
  tagNew: z.boolean().default(false),
  tagPreorder: z.boolean().default(false),
  tagLimited: z.boolean().default(false),
  tagBestseller: z.boolean().default(false),
  // Product-locked coupons valid on this product (see Discount.scope). Anything that isn't
  // actually a product-locked coupon is ignored when saving — global coupons need no attaching.
  couponIds: z.array(z.string()).default([]),
  variants: z.array(variantSchema).min(1),
  sizeGuide: z
    .object({
      columns: z.array(z.string().trim().min(1)).min(1).max(MAX_SIZE_GUIDE_COLUMNS),
      rows: z.array(z.object({ size: z.string().trim().min(1), values: z.array(z.string()) })).min(1),
    })
    .nullable()
    .default(null),
}).superRefine((data, ctx) => {
  if (data.status === "ACTIVE") {
    if (!data.build) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["build"], message: "Build is required to publish — fabric, fit and details." });
    if (!data.howToWear) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["howToWear"], message: "How n when to wear is required to publish — styling and occasions." });
  }
  if (data.discountType && data.discountValue == null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["discountValue"], message: "Enter a discount amount or percent." });
  }
  if (data.discountType === "PERCENT" && data.discountValue != null && data.discountValue > 100) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["discountValue"], message: "Percent off can't exceed 100." });
  }
  if (data.discountType === "AMOUNT" && data.discountValue != null && data.discountValue >= data.basePrice) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["discountValue"], message: "Amount off must be less than the base price." });
  }
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
      // The description messages already name their section ("Build is required to publish…"),
      // and the field key (howToWear) isn't what the admin sees on screen — so no prefix.
      if (field === "mood" || field === "build" || field === "howToWear") return issue.message;
      return `${typeof field === "string" ? field : "Product"}: ${issue.message}`;
    })
    .join(" ");
}

export async function saveProduct(input: ProductFormInput): Promise<ProductSaveResult> {
  const actor = await requireAdmin();
  // The purchase cost is a finance figure: only an account that can open Finance may set or clear
  // it. Staff saving a product leave it exactly as it was, whatever their request says.
  const mayEditCost = canAccessArea(actor.role, "finance");
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
        include: { variants: true },
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
          description: data.mood,
          mood: data.mood,
          build: data.build || null,
          howToWear: data.howToWear || null,
          gender: category.gender,
          categoryId: data.categoryId,
          basePrice: data.basePrice,
          ...(mayEditCost && data.purchaseCost !== undefined ? { purchaseCost: data.purchaseCost } : {}),
          discountType: data.discountType,
          discountValue: data.discountValue,
          status: data.status,
          seoTitle: data.seoTitle,
          seoDescription: data.seoDescription,
          freeDelivery: data.freeDelivery,
          deliveryChargeInsideDhaka: data.deliveryChargeInsideDhaka,
          deliveryChargeOutsideDhaka: data.deliveryChargeOutsideDhaka,
          sizeGuide: sizeGuideValue,
          // Only stamp publishedAt the first time a product goes live —
          // re-saving an already-active product must not re-trigger "New".
          publishedAt:
            data.status === "ACTIVE" ? (existing?.publishedAt ?? new Date()) : null,
        },
        create: {
          title: data.title,
          slug: finalSlug,
          description: data.mood,
          mood: data.mood,
          build: data.build || null,
          howToWear: data.howToWear || null,
          gender: category.gender,
          categoryId: data.categoryId,
          basePrice: data.basePrice,
          ...(mayEditCost && data.purchaseCost != null ? { purchaseCost: data.purchaseCost } : {}),
          discountType: data.discountType,
          discountValue: data.discountValue,
          status: data.status,
          seoTitle: data.seoTitle,
          seoDescription: data.seoDescription,
          freeDelivery: data.freeDelivery,
          deliveryChargeInsideDhaka: data.deliveryChargeInsideDhaka,
          deliveryChargeOutsideDhaka: data.deliveryChargeOutsideDhaka,
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
            // customer purchase (or a stepper edit) between then and save would get silently
            // overwritten by that stale value. Stock changes go through the editor's
            // VariantStockStepper (setVariantStock) instead; new variants still get their
            // initial count below.
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
        // A brand-new size/colour starts with the count typed in the form — record it as its opening balance.
        if (!v.id) await recordOpening(tx, record.id, { actorEmail: actor.email });
      }
      // Sizes removed from the form go with whatever stock they still had — written to the stock history first.
      const removedVariants = await tx.variant.findMany({ where: { productId: productRecord.id, id: { notIn: keepIds } }, select: { id: true } });
      await recordRemoval(tx, removedVariants.map((r) => r.id), { actorEmail: actor.email });
      await tx.variant.deleteMany({ where: { productId: productRecord.id, id: { notIn: keepIds } } });

      // tags
      await tx.productTag.deleteMany({ where: { productId: productRecord.id } });
      const tagInserts: { type: string; enabled: boolean }[] = [
        { type: "NEW", enabled: data.tagNew },
        { type: "PREORDER", enabled: data.tagPreorder },
        { type: "LIMITED", enabled: data.tagLimited },
        { type: "BESTSELLER", enabled: data.tagBestseller },
      ];
      for (const t of tagInserts) {
        if (t.enabled && tagByType[t.type]) {
          await tx.productTag.create({
            data: { productId: productRecord.id, tagId: tagByType[t.type].id },
          });
        }
      }

      // product-locked coupons: only PRODUCT-scope coupons are ever (dis)connected, so a coupon
      // that's been switched to global and back keeps its attachments rather than losing them to
      // an editor that couldn't show it.
      const productLocked = await tx.discount.findMany({ where: { scope: "PRODUCT" }, select: { id: true } });
      const wanted = new Set(data.couponIds);
      await tx.product.update({
        where: { id: productRecord.id },
        data: {
          coupons: {
            connect: productLocked.filter((c) => wanted.has(c.id)).map((c) => ({ id: c.id })),
            disconnect: productLocked.filter((c) => !wanted.has(c.id)).map((c) => ({ id: c.id })),
          },
        },
      });

      return productRecord;
    }, { timeout: 15000 }));

    revalidatePath("/admin/products");
    revalidatePath(`/admin/products/${product.id}`);
    invalidateProduct({ id: product.id, slug: product.slug });
    if (existing && existing.slug !== product.slug) invalidateProduct({ slug: existing.slug });
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
    return { ok: false, error: `This product couldn't be saved. ${describeError(e)}` };
  }
}

export async function deleteProduct(id: string) {
  const admin = await requireAdmin();
  const existing = await db.product.findUnique({ where: { id }, select: { slug: true } });
  try {
    await db.$transaction(async (tx) => {
      // The stock the product still holds leaves with it — written to the stock history first.
      const variants = await tx.variant.findMany({ where: { productId: id }, select: { id: true } });
      await recordRemoval(tx, variants.map((v) => v.id), { actorEmail: admin.email, note: "Product deleted while it still had stock" });
      await tx.product.delete({ where: { id } });
    });
  } catch (e) {
    // P2025 = record already gone (double-submit) — deleting is idempotent, just continue.
    if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025")) throw e;
  }
  await fs.rm(path.join(process.cwd(), "public", "uploads", "products", id), { recursive: true, force: true });
  revalidatePath("/admin/products");
  invalidateProduct({ id, slug: existing?.slug });
  redirect("/admin/products");
}

export type { ProductImageRow } from "@/lib/product-images";

/** Persists a drag/arrow-button reorder from the product editor's image grid — `orderedIds` is
 * the full set of this product's image IDs in their new display order, which becomes the new
 * `position` (0, 1, 2, …) for each row. The first image (position 0) is what ProductCard.tsx and
 * every other "primary image" lookup treats as the product's cover photo, so this is also how an
 * admin changes which photo that is. Rejects a stale/mismatched ID list rather than silently
 * reordering a subset, since that could leave `position` with gaps or duplicates. */
export async function reorderProductImages(
  productId: string,
  orderedIds: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin();

  const product = await db.product.findUnique({ where: { id: productId }, select: { id: true, slug: true } });
  if (!product) return { ok: false, error: "Product not found." };

  const existing = await db.productImage.findMany({ where: { productId }, select: { id: true } });
  const existingIds = new Set(existing.map((img) => img.id));
  if (orderedIds.length !== existing.length || !orderedIds.every((id) => existingIds.has(id))) {
    return { ok: false, error: "Image list is out of date — refresh and try again." };
  }

  await db.$transaction(orderedIds.map((id, position) => db.productImage.update({ where: { id }, data: { position } })));

  revalidatePath(`/admin/products/${productId}`);
  revalidatePath("/admin/products");
  invalidateProduct({ id: productId, slug: product.slug });
  return { ok: true };
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
  const owner = await db.product.findUnique({ where: { id: image.productId }, select: { slug: true } });
  invalidateProduct({ id: image.productId, slug: owner?.slug });
  return { ok: true };
}
