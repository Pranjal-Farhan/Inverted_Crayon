import "server-only";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { deriveProductDisplay } from "@/lib/product-view";

export async function getProductForPDP(slug: string) {
  const [product, campaigns] = await Promise.all([
    db.product.findUnique({
      where: { slug },
      include: {
        variants: true,
        images: { orderBy: { position: "asc" } },
        tags: { include: { tag: true } },
        category: true,
        reviews: { where: { status: "APPROVED" }, orderBy: { createdAt: "desc" } },
      },
    }),
    db.campaign.findMany({
      where: { active: true, startsAt: { lte: new Date() }, endsAt: { gte: new Date() } },
    }),
  ]);
  if (!product) return null;

  const now = new Date();
  const display = deriveProductDisplay(product, campaigns, now);

  const relatedRaw = await db.product.findMany({
    where: { categoryId: product.categoryId, id: { not: product.id }, status: "ACTIVE" },
    include: { variants: true, images: true, tags: { include: { tag: true } }, category: true },
    take: 4,
  });
  const related = relatedRaw.map((p) => deriveProductDisplay(p, campaigns, now));

  return { product, display, related };
}

/**
 * Tagged, per-slug cached read for the public product page (src/app/(storefront)/product/[slug]/page.tsx).
 * Built per-call (the documented unstable_cache pattern for a per-argument tag) so each slug gets
 * its own `product:<slug>` tag alongside the shared `products` tag — see src/actions/admin-products.ts
 * for what invalidates it.
 *
 * unstable_cache serializes the return value through JSON, which turns Date fields into strings.
 * `display.basePrice`/`salePrice` are already plain numbers (deriveProductDisplay runs toNumber()
 * before this gets cached), so those are unaffected. product.reviews[].createdAt is a real Date
 * going in, and ReviewList.tsx calls .toLocaleDateString() on it directly, so it's re-hydrated
 * back to a Date below — the one serialization edge case this query actually hits.
 */
export async function getCachedProductForPDP(slug: string) {
  const data = await unstable_cache(
    () => getProductForPDP(slug),
    ["pdp-product", slug],
    // "reviews" tagged here too (not a separately-cached read) — review approval/rejection
    // invalidates by this generic tag rather than needing to resolve which product a review
    // belongs to. See src/actions/admin-reviews.ts.
    { tags: ["products", `product:${slug}`, "reviews"] },
  )();
  if (!data) return data;
  return {
    ...data,
    product: {
      ...data.product,
      reviews: data.product.reviews.map((r) => ({ ...r, createdAt: new Date(r.createdAt) })),
    },
  };
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
