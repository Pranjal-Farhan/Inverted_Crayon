import { db } from "@/lib/db";
import { deriveProductDisplay, type ProductDisplay } from "@/lib/product-view";
import type { Prisma } from "@/generated/prisma/client";

export type PLPTag = "preorder" | "sale" | "new" | "limited" | "bestseller";
export type PLPSort = "newest" | "price-asc" | "price-desc" | "bestselling";
export type PriceBand = "under2k" | "2k-3k" | "3kplus";

export type PLPParams = {
  gender?: "MEN" | "WOMEN";
  categorySlug?: string;
  collectionSlug?: string;
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

export async function getPLPResults(params: PLPParams) {
  const where: Prisma.ProductWhereInput = { status: "ACTIVE" };
  if (params.gender) where.gender = params.gender;
  if (params.categorySlug) where.category = { slug: params.categorySlug };
  if (params.collectionSlug) {
    where.collections = { some: { collection: { slug: params.collectionSlug } } };
  }
  if (params.q) where.title = { contains: params.q, mode: "insensitive" };

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

  const variantsByProduct = new Map(products.map((p) => [p.id, p.variants]));
  let display: ProductDisplay[] = products.map((p) => deriveProductDisplay(p, campaigns, now));

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

  const availableSizes = [...new Set(products.flatMap((p) => p.variants.map((v) => v.size)))];
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
