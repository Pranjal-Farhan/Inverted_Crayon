import "server-only";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { getChatWidgetSettings, getStoreInfo } from "@/lib/store-settings";

/**
 * Tagged `unstable_cache` wrappers around the shared DB reads that used to run on every single
 * storefront request — cacheComponents is not enabled in next.config.ts, so this is the Next 16
 * "Caching (Previous Model)" approach the perf task's ground rules call for. Public pages only.
 * Admin pages and every admin edit form must keep reading through store-settings.ts / db directly
 * (never through here) so they always see fresh data — see ground rule 4 in the perf task brief.
 *
 * unstable_cache serializes return values through JSON: Decimal fields (basePrice, priceOverride,
 * preorderAdvanceAmount) come back as strings, but every call site already goes through
 * src/lib/money.ts's toNumber(), which already handles strings as well as Decimal objects, so
 * that's a no-op change. Date fields (createdAt/updatedAt/publishedAt) come back as strings too;
 * nothing downstream of these specific functions calls a Date method on them directly (verified —
 * the one place in the app that does, the account orders page, doesn't read through this module).
 *
 * Invalidated from src/actions/* on the matching mutation — see the Fix 3 commit for the full
 * action-to-tag checklist.
 *
 * A handful of these (noted individually below) also carry a `revalidate: 300` option on top of
 * their tags, as a safety net: tag invalidation only fires when an admin *action* runs, so a
 * price/badge derived from an unstable_cache entry with no time limit would stay wrong
 * indefinitely if some change slipped past an action. Note that the page-level
 * `export const revalidate` (the ISR shell timer) does NOT substitute for this: it only controls
 * how often the page's rendered HTML regenerates, and a regeneration that calls back into one of
 * these functions still gets whatever this cache already has until this cache's own timer or a
 * tag invalidation says otherwise — this is Next's Data Cache, a separate layer from the page's
 * Full Route Cache. 300s caps that window; it's cosmetic (checkout and admin always read fresh
 * regardless — ground rules 3/4).
 */

export const PRODUCT_CARD_INCLUDE = {
  variants: true,
  // Without an explicit orderBy, Postgres returns a product's images in whatever order its own
  // storage happens to have them in — not necessarily `position` order, and that drifts further
  // once admins reorder images (an UPDATE moves a row's tuple, not its scan order). ProductCard
  // and the homepage featured-drop both take "the first image with a url" as the cover photo, so
  // an unordered fetch could hand them any image in the gallery instead of the intended cover.
  images: { orderBy: { position: "asc" } },
  tags: { include: { tag: true } },
  category: true,
} as const;

// ---- sale ----

// Whether any live product currently carries a markdown — drives the pulsing dot beside "SALE" in
// the header. Product discounts have no start/end date, so only a product save changes this and
// the "products" tag (invalidated by every product mutation) is enough.
export const getSaleActive = unstable_cache(
  async () => (await db.product.count({ where: { status: "ACTIVE", discountType: { not: null }, discountValue: { not: null } } })) > 0,
  ["public-sale-active"],
  { tags: ["products"] },
);

// ---- content blocks ----

export const getContentBlock = unstable_cache(
  async (key: string) => db.contentBlock.findUnique({ where: { key } }),
  ["public-content-block"],
  { tags: ["content"] },
);

// ---- settings ----

export const getCachedChatWidgetSettings = unstable_cache(
  async () => getChatWidgetSettings(),
  ["public-chat-widget-settings"],
  { tags: ["settings"] },
);

export const getCachedStoreInfo = unstable_cache(
  async () => getStoreInfo(),
  ["public-store-info"],
  { tags: ["settings"] },
);

// ---- categories ----

export const getNavCategories = unstable_cache(
  async () => {
    const categoryRows = await db.category.findMany({
      where: { gender: { in: ["MEN", "WOMEN"] } },
      orderBy: { position: "asc" },
      select: { slug: true, name: true, gender: true },
    });
    return {
      men: categoryRows.filter((c) => c.gender === "MEN").map((c) => ({ slug: c.slug, name: c.name })),
      women: categoryRows.filter((c) => c.gender === "WOMEN").map((c) => ({ slug: c.slug, name: c.name })),
    };
  },
  ["public-nav-categories"],
  { tags: ["categories"] },
);

export type ExplorerCategory = {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  gender: "MEN" | "WOMEN" | "UNISEX";
};

// Data for the homepage's Male/Female -> subcategory -> product drill-down (CategoryExplorer.tsx).
// Only categories with at least one active product are ever offered (nothing leads to a dead end).
// A Unisex category (e.g. Essentials) has no gender card of its own — the drill-down only opens
// from Male or Female — so it's appended to *both* branch's subcategory list instead, same
// "reaches both branches" convention get-product.ts already uses for "Complete the Look."
// Product previews are capped per category (take 8) and fetched once here rather than re-queried
// per click, since this whole function sits behind the homepage's unstable_cache + revalidate:300 —
// the extra rows cost nothing per visit, only once every 5 minutes at most.
export const getHomeCategoryExplorerData = unstable_cache(
  async () => {
    const categoryRows = await db.category.findMany({
      where: { products: { some: { status: "ACTIVE" } } },
      orderBy: [{ gender: "asc" }, { position: "asc" }],
    });
    const men = categoryRows.filter((c) => c.gender === "MEN");
    const women = categoryRows.filter((c) => c.gender === "WOMEN");
    const unisex = categoryRows.filter((c) => c.gender === "UNISEX");

    const productRows = await db.product.findMany({
      where: { status: "ACTIVE", categoryId: { in: categoryRows.map((c) => c.id) } },
      include: PRODUCT_CARD_INCLUDE,
      orderBy: { publishedAt: "desc" },
    });
    const productsByCategory: Record<string, typeof productRows> = {};
    for (const p of productRows) {
      (productsByCategory[p.categoryId] ??= []).push(p);
    }
    for (const key of Object.keys(productsByCategory)) {
      productsByCategory[key] = productsByCategory[key].slice(0, 8);
    }

    return {
      men: [...men, ...unisex],
      women: [...women, ...unisex],
      productsByCategory,
    };
  },
  ["public-home-category-explorer"],
  { tags: ["categories", "products"], revalidate: 300 },
);

export function getGenderCategories(gender: "MEN" | "WOMEN") {
  return unstable_cache(
    () => db.category.findMany({ where: { gender }, orderBy: { position: "asc" } }),
    ["public-gender-categories", gender],
    { tags: ["categories"] },
  )();
}

export function getCategoryByGenderSlug(gender: "MEN" | "WOMEN", slug: string) {
  return unstable_cache(
    () => db.category.findFirst({ where: { gender, slug } }),
    ["public-category-by-gender-slug", gender, slug],
    { tags: ["categories"] },
  )();
}

// ---- products ----

// These four carry display-level sale pricing (ProductCard reads onSale/salePrice, derived from
// the product's own discount), so they get the revalidate: 300 treatment too — see the module doc.
// Fetches one page beyond the first screenful (NEW_IN_PAGE_SIZE) so the homepage can tell
// whether to show the "Load more" button on first render without a separate count query —
// NewInGrid.tsx's own "load more" pages come from /api/products/new instead (not cached here,
// same pattern as /api/products/by-ids), since those are paginated on demand, not once per ISR
// regeneration.
export const NEW_IN_PAGE_SIZE = 20;

export const getHomeNewProducts = unstable_cache(
  async () =>
    db.product.findMany({
      where: { status: "ACTIVE" },
      include: PRODUCT_CARD_INCLUDE,
      orderBy: { publishedAt: "desc" },
      take: NEW_IN_PAGE_SIZE + 1,
    }),
  ["public-home-new-products"],
  { tags: ["products"], revalidate: 300 },
);

// No `take` cap — GenderHub.tsx renders every one of these under an "All Products {label}" heading
// with no pagination, so capping this query silently hid products the heading promised to show.
export function getGenderHubProducts(gender: "MEN" | "WOMEN") {
  return unstable_cache(
    () =>
      db.product.findMany({
        where: { gender: { in: [gender, "UNISEX"] }, status: "ACTIVE" },
        include: PRODUCT_CARD_INCLUDE,
        orderBy: { publishedAt: "desc" },
      }),
    ["public-gender-hub-products", gender],
    { tags: ["products"], revalidate: 300 },
  )();
}

export function getCachedProductById(id: string) {
  return unstable_cache(
    () => db.product.findUnique({ where: { id }, include: PRODUCT_CARD_INCLUDE }),
    ["public-product-by-id", id],
    { tags: ["products", `product:${id}`], revalidate: 300 },
  )();
}

// No revalidate here: lookbook renders images/links only, no price or sale badge.
export const getLookbookProducts = unstable_cache(
  async () => db.product.findMany({ where: { status: "ACTIVE" }, orderBy: { publishedAt: "desc" }, take: 8 }),
  ["public-lookbook-products"],
  { tags: ["products"] },
);

export const getCartRecommendations = unstable_cache(
  async () =>
    db.product.findMany({
      where: { status: "ACTIVE" },
      include: PRODUCT_CARD_INCLUDE,
      orderBy: { publishedAt: "desc" },
      take: 4,
    }),
  ["public-cart-recommendations"],
  { tags: ["products"], revalidate: 300 },
);
