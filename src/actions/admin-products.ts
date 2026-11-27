"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import fs from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { requireAdminArea } from "@/lib/admin-guard";
import { canAccessArea } from "@/lib/admin-areas";
import { ensureMirrorCategories } from "@/lib/categories";
import { slugify } from "@/lib/slugify";
import { formatProductValidationError, productSchema, type ProductFormInput } from "@/lib/product-schema";
import { invalidateProduct } from "@/lib/invalidate";
import { recordOpenings, recordRemoval } from "@/lib/stock";
import { describeError } from "@/lib/action-errors";

async function requireAdmin() {
  return requireAdminArea("products");
}

function randomToken(len: number, upper: boolean): string {
  const s = Math.random().toString(36).slice(2, 2 + len);
  return upper ? s.toUpperCase() : s;
}

/** The client already builds a title/size/color-derived SKU the instant a variant row is
 * created (ProductEditorForm.tsx), and the admin can type over it — this sanitizes every one
 * defensively and re-verifies they are actually unique against the database before anything is
 * written, appending a short random suffix (and re-checking) only to the ones whose exact value is
 * already taken by some other variant, or repeated within this very batch. Globally unique by
 * schema, so even an admin reusing an identical title/size/color combo across two different
 * products can't collide. One query for the whole batch — not one per size — because this runs
 * inside the save transaction, where every round trip to the database counts against its time limit. */
async function ensureUniqueSkus(tx: Prisma.TransactionClient, candidates: string[]): Promise<string[]> {
  const bases = candidates.map((c) => c.trim().replace(/[^a-zA-Z0-9-]/g, "").toUpperCase().slice(0, 40) || "SKU");
  const inDb = new Set((await tx.variant.findMany({ where: { sku: { in: [...new Set(bases)] } }, select: { sku: true } })).map((r) => r.sku));
  const used = new Set(inDb);
  const result: string[] = [];
  let pending: number[] = [];
  bases.forEach((base, i) => {
    if (used.has(base)) pending.push(i);
    else {
      used.add(base);
      result[i] = base;
    }
  });
  // Only the (rare) taken ones need a suffix: try a few rounds, checking the suffixed values too.
  for (let round = 0; pending.length > 0 && round < 5; round++) {
    const tries = pending.map((i) => `${bases[i]}-${randomToken(round < 4 ? 4 : 8, true)}`);
    const clash = new Set((await tx.variant.findMany({ where: { sku: { in: tries } }, select: { sku: true } })).map((r) => r.sku));
    const still: number[] = [];
    pending.forEach((i, k) => {
      if (clash.has(tries[k]) || used.has(tries[k])) still.push(i);
      else {
        used.add(tries[k]);
        result[i] = tries[k];
      }
    });
    pending = still;
  }
  for (const i of pending) result[i] = `${bases[i]}-${randomToken(10, true)}`; // practically unreachable
  return result;
}

/** A stored price (Decimal or null) equals what the form sent (number, null or absent). */
function sameMoney(stored: { toNumber(): number } | null, sent: number | null | undefined): boolean {
  return stored === null ? sent == null : sent != null && stored.toNumber() === sent;
}

/** Same idea as ensureUniqueSkus, for Product.slug — re-slugifies the admin's intended slug
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

/** ensureUniqueSlug/ensureUniqueSkus check-then-write inside their own transaction, which closes
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

export type { ProductFormInput };
export type ProductSaveResult = { ok: true; id: string } | { ok: false; error: string };

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
    // Independent of each other, so asked at the same time — each is a round trip to the database.
    const [category, tags, existing, placementRows] = await Promise.all([
      db.category.findUnique({ where: { id: data.categoryId } }),
      db.tag.findMany(),
      data.id ? db.product.findUnique({ where: { id: data.id }, include: { variants: true } }) : Promise.resolve(null),
      // The Men / Women subcategories a Unisex product is also listed under, if any were chosen.
      data.menCategoryId || data.womenCategoryId
        ? db.category.findMany({ where: { id: { in: [data.menCategoryId, data.womenCategoryId].filter((id): id is string => !!id) } } })
        : Promise.resolve([]),
    ]);
    if (!category) return { ok: false, error: "Select a valid category." };
    // Only a Unisex product is listed under a chosen Men / Women subcategory; for any other product the
    // choice is dropped. A choice has to be a category of the matching branch (a Men category for the Men slot…).
    const placedIn = (id: string | null, branch: "MEN" | "WOMEN") => {
      if (category.gender !== "UNISEX" || !id) return { ok: true as const, id: null };
      const row = placementRows.find((c) => c.id === id);
      return row && row.gender === branch ? { ok: true as const, id } : { ok: false as const, id: null };
    };
    const menPlacement = placedIn(data.menCategoryId, "MEN");
    const womenPlacement = placedIn(data.womenCategoryId, "WOMEN");
    if (!menPlacement.ok) return { ok: false, error: "Select a valid Men sub category." };
    if (!womenPlacement.ok) return { ok: false, error: "Select a valid Women sub category." };
    // Self-healing: a Unisex category created before its Men/Women mirrors existed (or one
    // that predates this feature) gets them backfilled here too, not just at creation time.
    if (category.gender === "UNISEX") await ensureMirrorCategories(category.name, category.slug);

    const tagByType = Object.fromEntries(tags.map((t) => [t.type, t]));
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
          mood: data.mood || null,
          build: data.build || null,
          howToWear: data.howToWear || null,
          gender: category.gender,
          categoryId: data.categoryId,
          menCategoryId: menPlacement.id,
          womenCategoryId: womenPlacement.id,
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
          mood: data.mood || null,
          build: data.build || null,
          howToWear: data.howToWear || null,
          gender: category.gender,
          categoryId: data.categoryId,
          menCategoryId: menPlacement.id,
          womenCategoryId: womenPlacement.id,
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

      // ---- variants
      //
      // Round trips are the cost that matters in here: the whole save is one transaction with a
      // time limit, and the database may be far away. Saving used to make several calls PER SIZE
      // (a "park" update, an uniqueness check, an upsert, an opening-balance row) — about 250 calls
      // for a product with 54 variants, which at 200 ms apiece ran out of time and rolled back
      // ("The database took too long to finish this"). Now the number of calls doesn't grow with
      // the number of sizes:
      //   - existing sizes are compared with what is stored, in memory, and only the ones that
      //     really changed are written (identical changes share one statement);
      //   - new sizes get their SKUs checked in one query, are created in one insert, and their
      //     opening-balance rows go in with one more.
      const existingById = new Map(existingVariants.map((e) => [e.id, e]));
      const kept = variants.filter((v) => v.id !== undefined && existingById.has(v.id));
      // A size with no id — or an id that isn't one of THIS product's variants, which must never
      // be able to touch another product's rows — is a new size.
      const fresh = variants.filter((v) => v.id === undefined || !existingById.has(v.id));

      const patches = new Map<string, { ids: string[]; data: Prisma.VariantUpdateManyMutationInput }>();
      const moving: string[] = [];
      for (const v of kept) {
        const e = existingById.get(v.id!)!;
        const data: Prisma.VariantUpdateManyMutationInput = {};
        const moves = e.size !== v.size || e.color !== v.color;
        // A size whose (size, color) changes is written with both, because it is parked first (below).
        if (moves) {
          data.size = v.size;
          data.color = v.color;
          moving.push(v.id!);
        }
        if (v.colorHex !== undefined && e.colorHex !== v.colorHex) data.colorHex = v.colorHex;
        if (e.lowStockThreshold !== v.lowStockThreshold) data.lowStockThreshold = v.lowStockThreshold;
        if (!sameMoney(e.priceOverride, v.priceOverride)) data.priceOverride = v.priceOverride ?? null;
        // sku deliberately never changes after creation, and stockQty is left alone: this form loads
        // stock at page-open time, and a customer purchase (or a stepper edit) between then and save
        // would get silently overwritten by that stale value. Stock changes go through the editor's
        // VariantStockStepper (setVariantStock) instead; new variants still get their initial count below.
        if (!sameMoney(e.preorderAdvanceAmount, v.preorderAdvanceAmount)) data.preorderAdvanceAmount = v.preorderAdvanceAmount ?? null;
        if (Object.keys(data).length === 0) continue;
        const key = JSON.stringify(data);
        const group = patches.get(key);
        if (group) group.ids.push(v.id!);
        else patches.set(key, { ids: [v.id!], data });
      }

      // Every size that is changing (size, color) is parked on a temporary, per-variant-unique
      // value first, before any real value is written. Without this, two existing rows that swap
      // sizes (A: M→L, B: L→M — a perfectly valid *final* state, no duplicate anywhere) can
      // still fail: Postgres checks @@unique([productId, size, color]) immediately after each
      // UPDATE, not deferred to commit, so writing A's new size while B still holds the old one
      // collides mid-transaction even though nothing is actually wrong once both rows have
      // landed. `__tmp_<id>` is unique by construction (variant ids are unique and real
      // size/color values never contain one), so this pass can never collide with anything,
      // vacating every slot before the real pass risks touching one that's still "in use" by a
      // row that hasn't been updated yet. One statement for all of them.
      if (moving.length > 0) {
        await tx.$executeRaw`UPDATE "Variant" SET "size" = '__tmp_' || "id", "color" = '__tmp_' || "id" WHERE "productId" = ${productRecord.id} AND "id" IN (${Prisma.join(moving)})`;
      }
      for (const { ids, data: patch } of patches.values()) {
        await tx.variant.updateMany({ where: { productId: productRecord.id, id: { in: ids } }, data: patch });
      }

      const keepIds = new Set(kept.map((v) => v.id!));
      if (fresh.length > 0) {
        // Only new variants need their SKU verified (an existing one keeps whatever it already has).
        const skus = await ensureUniqueSkus(tx, fresh.map((v) => v.sku));
        const created = await tx.variant.createManyAndReturn({
          data: fresh.map((v, i) => ({
            productId: productRecord.id,
            sku: skus[i],
            size: v.size,
            color: v.color,
            colorHex: v.colorHex,
            stockQty: v.stockQty,
            lowStockThreshold: v.lowStockThreshold,
            priceOverride: v.priceOverride ?? null,
            preorderAdvanceAmount: v.preorderAdvanceAmount ?? null,
          })),
          select: { id: true, sku: true, size: true, color: true, stockQty: true },
        });
        for (const c of created) keepIds.add(c.id);
        // A brand-new size/colour starts with the count typed in the form — record it as its opening balance.
        await recordOpenings(tx, created, productRecord.title, { actorEmail: actor.email });
      }

      // Sizes removed from the form go with whatever stock they still had — written to the stock history first.
      const removedIds = existingVariants.filter((e) => !keepIds.has(e.id)).map((e) => e.id);
      if (removedIds.length > 0) {
        await recordRemoval(tx, removedIds, { actorEmail: actor.email });
        await tx.variant.deleteMany({ where: { productId: productRecord.id, id: { in: removedIds } } });
      }

      // tags
      if (existing) await tx.productTag.deleteMany({ where: { productId: productRecord.id } });
      const tagRows = (
        [
          ["NEW", data.tagNew],
          ["PREORDER", data.tagPreorder],
          ["LIMITED", data.tagLimited],
          ["BESTSELLER", data.tagBestseller],
        ] as const
      )
        .filter(([type, enabled]) => enabled && tagByType[type])
        .map(([type]) => ({ productId: productRecord.id, tagId: tagByType[type].id }));
      if (tagRows.length > 0) await tx.productTag.createMany({ data: tagRows });

      // product-locked coupons: only PRODUCT-scope coupons are ever (dis)connected, so a coupon
      // that's been switched to global and back keeps its attachments rather than losing them to
      // an editor that couldn't show it. (A new product with none ticked has nothing to connect.)
      if (existing || data.couponIds.length > 0) {
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
      }

      return productRecord;
    }, { timeout: 30000, maxWait: 10000 }));

    revalidatePath("/admin/products");
    revalidatePath(`/admin/products/${product.id}`);
    invalidateProduct({ id: product.id, slug: product.slug });
    if (existing && existing.slug !== product.slug) invalidateProduct({ slug: existing.slug });
    return { ok: true, id: product.id };
  } catch (e) {
    // ensureUniqueSlug/ensureUniqueSkus already resolve the overwhelming majority of collisions
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
