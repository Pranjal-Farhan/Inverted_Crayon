// Deliberately NOT importing anything from src/lib/plp.ts at runtime (only as `import type`,
// which TypeScript fully erases) — plp.ts pulls in db.ts (Prisma/pg, and now guarded by
// "server-only"), and this module is bundled into client JS by StaticPLPClient.tsx. A real
// runtime import here would either hard-fail the build (server-only) or, worse, risk bundling
// database code into the browser.
import type { PLPCatalogItem, PLPParams } from "@/lib/plp";

const PAGE_SIZE = 24;

export type PLPFilterParams = Omit<PLPParams, "gender" | "categorySlug">;

export type PLPFilterResults = {
  items: PLPCatalogItem[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
};

/**
 * Pure, synchronous filter/sort/paginate over an already-fetched catalog — the exact same logic
 * src/lib/plp.ts's getPLPResults used to run server-side against a DB-backed array, now reused
 * client-side (StaticPLPClient.tsx) and, for the still-dynamic /search page... actually /search
 * keeps using the original server-side getPLPResults unchanged, so this function exists solely
 * for the static pages. Kept behaviorally identical on purpose.
 */
export function applyPLPFilters(catalog: PLPCatalogItem[], params: PLPFilterParams): PLPFilterResults {
  let display = catalog;

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
    display = display.filter((d) => d.sizes.some((s) => params.sizes!.includes(s)));
  }
  if (params.colors?.length) {
    display = display.filter((d) => d.colors.some((c) => params.colors!.includes(c)));
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
    const at = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
    const bt = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
    return bt - at;
  });

  const total = display.length;
  const page = Math.max(params.page ?? 1, 1);
  const items = display.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return { items, total, page, pageSize: PAGE_SIZE, hasMore: page * PAGE_SIZE < total };
}
