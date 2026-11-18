"use server";

import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { parseSizeGuide, type SizeGuideData } from "@/lib/size-guide";

// What slugify() produces — anything else can't be a product, and isn't worth a cache entry.
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const getCachedSizeGuideProduct = (slug: string) =>
  unstable_cache(
    // ACTIVE only, like the product page itself: a draft's name stays private until it's published.
    () => db.product.findUnique({ where: { slug, status: "ACTIVE" }, select: { title: true, sizeGuide: true } }),
    ["public-size-guide-product", slug],
    { tags: ["products", `product:${slug}`] },
  )();

/** null = no product with that slug. `table` is null when the product exists but its admins never
 * entered a size guide — there is no default chart to fall back to. */
export type SizeGuideLookupResult = { title: string; table: SizeGuideData | null } | null;

/**
 * Called client-side by SizeGuideClient.tsx now that /size-guide no longer reads the `?product=`
 * searchParam server-side (see size-guide/page.tsx) — the same cached, tagged DB read that used
 * to live inline in the page component, just reachable from the client now. Returns null if the
 * slug doesn't exist at all (distinct from "exists but has no size guide entered", which returns
 * the title with `table: null`).
 */
export async function getSizeGuideForProduct(slug: string): Promise<SizeGuideLookupResult> {
  if (typeof slug !== "string" || slug.length > 160 || !SLUG_PATTERN.test(slug)) return null;
  const product = await getCachedSizeGuideProduct(slug);
  if (!product) return null;
  return { title: product.title, table: parseSizeGuide(product.sizeGuide) };
}
