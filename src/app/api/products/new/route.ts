import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { PRODUCT_CARD_INCLUDE, getActiveCampaigns, NEW_IN_PAGE_SIZE } from "@/lib/public-cache";
import { deriveProductDisplay } from "@/lib/product-view";

/** Pagination for the homepage's "New In" grid (NewInGrid.tsx) — the first page ships with the
 * ISR'd homepage itself (getHomeNewProducts), every "Load more" click after that comes through
 * here. Not cached (same reasoning as /api/products/by-ids): each skip value is a distinct,
 * rarely-repeated query, so an unstable_cache entry per page would just churn the cache store. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const skip = Math.max(0, Number(url.searchParams.get("skip") ?? 0) || 0);

  const now = new Date();
  const [campaigns, rows] = await Promise.all([
    getActiveCampaigns(),
    db.product.findMany({
      where: { status: "ACTIVE" },
      include: PRODUCT_CARD_INCLUDE,
      orderBy: { publishedAt: "desc" },
      skip,
      take: NEW_IN_PAGE_SIZE + 1,
    }),
  ]);

  const hasMore = rows.length > NEW_IN_PAGE_SIZE;
  const products = rows.slice(0, NEW_IN_PAGE_SIZE).map((p) => deriveProductDisplay(p, campaigns, now));

  return NextResponse.json({ products, hasMore });
}
