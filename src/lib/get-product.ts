import "server-only";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { bestSalePrice, deriveProductDisplay } from "@/lib/product-view";
import { toNumber } from "@/lib/money";

export async function getProductForPDP(slug: string) {
  const [product, campaigns] = await Promise.all([
    db.product.findUnique({
      where: { slug },
      include: {
        variants: true,
        images: { orderBy: { position: "asc" } },
        tags: { include: { tag: true } },
        category: true,
      },
    }),
    db.campaign.findMany({
      where: { active: true, startsAt: { lte: new Date() }, endsAt: { gte: new Date() } },
    }),
  ]);
  if (!product) return null;

  const now = new Date();
  const display = deriveProductDisplay(product, campaigns, now);

  // The top price block above already shows display.basePrice/salePrice (the product-level sale
  // price) — but AddToCartForm's size picker and the cart/checkout that follow it were built from
  // each variant's own priceOverride-or-basePrice with no sale applied at all, a pre-existing gap
  // (Campaign-era, not new to this discount feature) where the price shown while *choosing* a
  // size didn't match the price shown just above it. Same bestSalePrice() checkout.ts now uses as
  // the authoritative charge, so what's shown here always matches what's actually billed.
  const variantPrices: Record<string, number> = {};
  for (const v of product.variants) {
    const base = v.priceOverride != null ? toNumber(v.priceOverride) : toNumber(product.basePrice);
    variantPrices[v.id] = bestSalePrice(product, base, campaigns, now) ?? base;
  }

  // "Complete the look" suggests across the whole gender branch (any category), not just more of
  // this exact category — a Unisex product also pulls from both Men and Women, same convention
  // as the gender-scoped PLP catalogs in src/lib/plp.ts.
  const relatedGenders: ("MEN" | "WOMEN" | "UNISEX")[] =
    product.gender === "UNISEX" ? ["MEN", "WOMEN", "UNISEX"] : [product.gender, "UNISEX"];
  const relatedRaw = await db.product.findMany({
    where: { gender: { in: relatedGenders }, id: { not: product.id }, status: "ACTIVE" },
    include: { variants: true, images: { orderBy: { position: "asc" } }, tags: { include: { tag: true } }, category: true },
    take: 4,
  });
  const related = relatedRaw.map((p) => deriveProductDisplay(p, campaigns, now));

  return { product, display, related, variantPrices };
}

/**
 * Tagged, per-slug cached read for the public product page (src/app/(storefront)/product/[slug]/page.tsx).
 * Built per-call (the documented unstable_cache pattern for a per-argument tag) so each slug gets
 * its own `product:<slug>` tag alongside the shared `products` tag — see src/actions/admin-products.ts
 * for what invalidates it.
 *
 * unstable_cache serializes the return value through JSON, which turns Date fields into strings —
 * `display.basePrice`/`salePrice` are already plain numbers (deriveProductDisplay runs toNumber()
 * before this gets cached), so those are unaffected, and nothing else in this return value carries
 * a raw Date that a caller reads as one.
 */
export async function getCachedProductForPDP(slug: string) {
  return unstable_cache(
    () => getProductForPDP(slug),
    ["pdp-product", slug],
    // revalidate: 300 — display.onSale/salePrice (this product and its `related` list) are
    // derived from whichever campaigns are active right now. A campaign's startsAt/endsAt
    // crossing with no admin action never calls revalidateTag, so without this the PDP's sale
    // badge/price could stay wrong indefinitely rather than for a bounded window. The page's own
    // `export const revalidate = 300` (product/[slug]/page.tsx) controls how often the page's
    // HTML regenerates, not whether this specific cached read is still considered fresh when it
    // does — this option is what actually bounds that.
    { tags: ["products", `product:${slug}`], revalidate: 300 },
  )();
}

/** Build-time slugs for static product-page generation; falls back to empty (pure on-demand ISR) if the DB is unreachable at build time. */
export async function getAllActiveProductSlugs(): Promise<string[]> {
  try {
    const products = await db.product.findMany({ where: { status: "ACTIVE" }, select: { slug: true } });
    return products.map((p) => p.slug);
  } catch {
    return [];
  }
}
