"use server";

import { db } from "@/lib/db";
import { getAdminForArea } from "@/lib/admin-guard";
import { analyzeImport, MAX_IMPORT_CHARS, type ImportContext, type ImportItem } from "@/lib/product-import";
import { saveProduct } from "@/actions/admin-products";
import { describeError } from "@/lib/action-errors";

/**
 * The JSON product import (see src/lib/product-import.ts for the format and every rule). Two
 * actions, both open to whoever may use Products — the same people who can add a product by hand:
 *
 *  - previewProductImport(): reads the pasted JSON and reports, per product, what would happen.
 *    Writes nothing.
 *  - importProduct(): creates ONE product from the same JSON, through the real saveProduct (so SKUs,
 *    stock history, tags and the storefront caches come out exactly as if it had been typed into the
 *    form). The page calls it once per product, so a big paste can't run into the host's time limit
 *    and a failure stays confined to the product it happened on.
 *
 * Both re-read and re-check the JSON on the server every time; nothing the browser says about a
 * previous preview is trusted.
 */

export type ImportPreviewItem = Omit<ImportItem, "input">;
export type ImportPreview = { ok: true; items: ImportPreviewItem[] } | { ok: false; error: string };
export type ImportOneResult = { ok: true; id: string; slug: string; note?: string } | { ok: false; error: string };

const SESSION_ENDED = "Your session has ended — log in again, then try once more.";

async function contextFor(role: ImportContext["role"]): Promise<ImportContext> {
  const categories = await db.category.findMany({ select: { id: true, name: true, slug: true, gender: true } });
  return {
    role,
    categories,
    async findExisting(slugs, skus) {
      const products = slugs.length ? await db.product.findMany({ where: { slug: { in: slugs } }, select: { id: true, slug: true, title: true } }) : [];
      const variants = skus.length ? await db.variant.findMany({ where: { sku: { in: skus } }, select: { sku: true, product: { select: { title: true } } } }) : [];
      return {
        slugs: new Map(products.map((p) => [p.slug, { id: p.id, title: p.title }])),
        skus: new Map(variants.map((v) => [v.sku, v.product.title])),
      };
    },
  };
}

const validText = (json: unknown): json is string => typeof json === "string" && json.length <= MAX_IMPORT_CHARS;

export async function previewProductImport(json: string): Promise<ImportPreview> {
  const admin = await getAdminForArea("products");
  if (!admin) return { ok: false, error: SESSION_ENDED };
  if (!validText(json)) return { ok: false, error: "That's too much text for one import — split it into smaller files." };
  try {
    const analysis = await analyzeImport(json, await contextFor(admin.role));
    if (!analysis.ok) return analysis;
    // The built form data stays on the server.
    return { ok: true, items: analysis.items.map(({ input, ...rest }) => (void input, rest)) };
  } catch (e) {
    console.error("previewProductImport failed:", e);
    return { ok: false, error: `The preview couldn't be built. ${describeError(e)}` };
  }
}

export async function importProduct(json: string, index: number): Promise<ImportOneResult> {
  const admin = await getAdminForArea("products");
  if (!admin) return { ok: false, error: SESSION_ENDED };
  if (!validText(json) || !Number.isInteger(index) || index < 0) return { ok: false, error: "That request wasn't valid." };
  try {
    const analysis = await analyzeImport(json, await contextFor(admin.role));
    if (!analysis.ok) return { ok: false, error: analysis.error };
    const item = analysis.items[index];
    if (!item) return { ok: false, error: "There is no product at that position in the JSON." };
    if (item.state === "exists") return { ok: false, error: `"${item.title}" already exists, so it was skipped.` };
    if (item.state !== "ready" || !item.input) return { ok: false, error: item.errors.join(" ") || "This product has problems." };

    const saved = await saveProduct(item.input);
    if (!saved.ok) return saved;

    // saveProduct quietly adds a short suffix when a slug turns out to be taken (e.g. by someone else a
    // moment after the preview). Say so rather than leaving a surprising web address.
    const row = await db.product.findUnique({ where: { id: saved.id }, select: { slug: true } });
    const slug = row?.slug ?? item.slug;
    return {
      ok: true,
      id: saved.id,
      slug,
      ...(slug !== item.slug ? { note: `Saved with the web address "${slug}" because "${item.slug}" was taken a moment ago.` } : {}),
    };
  } catch (e) {
    console.error("importProduct failed:", e);
    return { ok: false, error: `This product couldn't be created. ${describeError(e)}` };
  }
}
