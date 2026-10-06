"use server";

import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { parseSizeGuide, GENERIC_SIZE_GUIDE, type SizeGuideData } from "@/lib/size-guide";

const getCachedSizeGuideProduct = (slug: string) =>
  unstable_cache(
    () => db.product.findUnique({ where: { slug }, select: { title: true, sizeGuide: true } }),
    ["public-size-guide-product", slug],
    { tags: ["products", `product:${slug}`] },
  )();

export type SizeGuideLookupResult = { title: string; table: SizeGuideData; isProductSpecific: boolean } | null;

/**
 * Called client-side by SizeGuideClient.tsx now that /size-guide no longer reads the `?product=`
 * searchParam server-side (see size-guide/page.tsx) — the same cached, tagged DB read that used
 * to live inline in the page component, just reachable from the client now. Returns null if the
 * slug doesn't exist at all (distinct from "exists but has no measurements entered", which still
 * returns the generic chart with isProductSpecific: false).
 */
export async function getSizeGuideForProduct(slug: string): Promise<SizeGuideLookupResult> {
  const product = await getCachedSizeGuideProduct(slug);
  if (!product) return null;
  const parsed = parseSizeGuide(product.sizeGuide);
  return { title: product.title, table: parsed ?? GENERIC_SIZE_GUIDE, isProductSpecific: Boolean(parsed) };
}
