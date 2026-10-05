import "server-only";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { deriveProductDisplay, type ProductDisplay } from "@/lib/product-view";
import { APPAREL_SIZES, ONE_SIZE } from "@/lib/sizes";
import type { Prisma } from "@/generated/prisma/client";

export type PLPTag = "preorder" | "sale" | "new" | "limited" | "bestseller";
export type PLPSort = "newest" | "price-asc" | "price-desc" | "bestselling";
export type PriceBand = "under2k" | "2k-3k" | "3kplus";

export type PLPParams = {
  gender?: "MEN" | "WOMEN";
  categorySlug?: string;
  tag?: PLPTag;
  q?: string;
  sizes?: string[];
  colors?: string[];
  priceBand?: PriceBand;
  inStockOnly?: boolean;
  sort?: PLPSort;
  page?: number;
};

const PAGE_SIZE = 24;

/**
 * Category/search/new/sale pages all stay dynamic (they read searchParams for filtering, which
 * forces per-request rendering regardless — see the Fix 2e writeup in the perf report), but the
 * expensive unfiltered catalog fetch underneath them doesn't need to re-run on every request.
 * Cached per (gender, categorySlug) scope — not per search query `q`, since that's free text with
 * effectively unbounded cardinality; `q` is instead applied in-memory below, the same way the
 * other filters (tag/size/color/price/sort) already are.
 */
function getCachedCatalogForScope(gender: PLPParams["gender"], categorySlug: string | undefined) {
  return unstable_cache(
    async () => {
      const where: Prisma.ProductWhereInput = { status: "ACTIVE" };
      // A Unisex product belongs on both the Men and Women floors — matching the branch's own
      // gender plus UNISEX (rather than strict equality) is what surfaces it there without
      // duplicating the product row. See the Category model's doc comment in schema.prisma.
      if (gender) where.gender = { in: [gender, "UNISEX"] };
      // Category slugs aren't globally unique (the same slug exists once per gender branch —
      // "jeans" under Men, Women, and Unisex are three different rows), so this matches by text
      // only; combined with the gender filter above it naturally picks up the right branch's row
      // (or, for a Unisex product under /men or /women, its own Unisex row by the same slug).
      if (categorySlug) where.category = { slug: categorySlug };

      const now = new Date();
      const [products, campaigns] = await Promise.all([
        db.product.findMany({
          where,
          include: {
            variants: true,
            images: true,
            tags: { include: { tag: true } },
            category: true,
          },
        }),
        db.campaign.findMany({ where: { active: true, startsAt: { lte: now }, endsAt: { gte: now } } }),
      ]);
      return { products, campaigns };
    },
    ["public-plp-catalog", gender ?? "all", categorySlug ?? "all"],
    // revalidate: 300 — this result carries both the campaign list and every product's derived
    // sale pricing, so a scheduled campaign startsAt/endsAt boundary (no admin action, nothing to
    // eagerly revalidateTag) would otherwise leave it wrong indefinitely — tag invalidation alone
    // isn't enough here. See the module doc on src/lib/public-cache.ts for why the page-level
    // `export const revalidate` on the pages that call this doesn't substitute for this.
    { tags: ["products", "campaigns"], revalidate: 300 },
  )();
}

export type PLPCatalogItem = ProductDisplay & {
  /** Distinct variant sizes/colors for this product — carried alongside ProductDisplay so a
   * client-side filter (src/lib/plp-filter.ts) can filter by size/color without needing the raw
   * Prisma variant rows. */
  sizes: string[];
  colors: string[];
};

/**
 * Server-side fetch of the full, unfiltered, already-scoped catalog for a gender/category —
 * used by /men/[category], /women/[category], /new, /sale, now that those pages are static and
 * do all filtering/sorting/pagination client-side (see StaticPLPView.tsx / StaticPLPClient.tsx).
 * Deliberately returns every item, not just one page of PAGE_SIZE — the static HTML this
 * produces is what a crawler sees, so every product in the category should be a real link in it.
 */
export async function getPLPCatalog(
  gender: PLPParams["gender"],
  categorySlug: string | undefined,
): Promise<PLPCatalogItem[]> {
  const { products, campaigns } = await getCachedCatalogForScope(gender, categorySlug);
  const now = new Date();
  return products.map((p) => ({
    ...deriveProductDisplay(p, campaigns, now),
    sizes: [...new Set(p.variants.map((v) => v.size))],
    colors: [...new Set(p.variants.map((v) => v.color))],
  }));
}

export async function getPLPResults(params: PLPParams) {
  const { products, campaigns } = await getCachedCatalogForScope(params.gender, params.categorySlug);

  const variantsByProduct = new Map(products.map((p) => [p.id, p.variants]));
  const now = new Date();
  let display: ProductDisplay[] = products.map((p) => deriveProductDisplay(p, campaigns, now));

  if (params.q) {
    const q = params.q.toLowerCase();
    display = display.filter((d) => d.title.toLowerCase().includes(q));
  }

  if (params.tag === "sale") display = display.filter((d) => d.onSale);
  if (params.tag === "preorder") display = display.filter((d) => d.isPreorder);
  if (params.tag === "new") display = display.filter((d) => d.isNew);
  if (params.tag === "limited") display = display.filter((d) => d.isLimited);
  if (params.tag === "bestseller") display = display.filter((d) => d.isBestseller);

  if (params.sizes?.length) {
    display = display.filter((d) => variantsByProduct.get(d.id)!.some((v) => params.sizes!.includes(v.size)));
  }
  if (params.colors?.length) {
    display = display.filter((d) => variantsByProduct.get(d.id)!.some((v) => params.colors!.includes(v.color)));
  }
  if (params.priceBand) {
    display = display.filter((d) => {
      const p = d.salePrice ?? d.basePrice;
      if (params.priceBand === "under2k") return p < 2000;
      if (params.priceBand === "2k-3k") return p >= 2000 && p <= 3000;
      return p > 3000;
    });
  }
  if (params.inStockOnly) display = display.filter((d) => !d.soldOut);

  const sort = params.sort ?? "newest";
  display = [...display].sort((a, b) => {
    if (sort === "price-asc") return (a.salePrice ?? a.basePrice) - (b.salePrice ?? b.basePrice);
    if (sort === "price-desc") return (b.salePrice ?? b.basePrice) - (a.salePrice ?? a.basePrice);
    if (sort === "bestselling") return Number(b.isBestseller) - Number(a.isBestseller);
    // newest
    const at = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const bt = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return bt - at;
  });

  const total = display.length;
  const page = Math.max(params.page ?? 1, 1);
  const items = display.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Sorted into the fixed canonical order (S…XXXL, then One Size) rather than whatever order
  // they happened to turn up in across products — matches the size filter's display order to
  // the PDP's own.
  const sizeOrder = [...APPAREL_SIZES, ONE_SIZE];
  const availableSizes = [...new Set(products.flatMap((p) => p.variants.map((v) => v.size)))].sort(
    (a, b) => sizeOrder.indexOf(a) - sizeOrder.indexOf(b),
  );
  const availableColors = [...new Set(products.flatMap((p) => p.variants.map((v) => v.color)))];

  return {
    items,
    total,
    page,
    pageSize: PAGE_SIZE,
    hasMore: page * PAGE_SIZE < total,
    availableSizes,
    availableColors,
  };
}
