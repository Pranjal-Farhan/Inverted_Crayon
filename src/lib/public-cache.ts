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
 * the only two places in the app that do, ReviewList.tsx and the account orders page, don't read
 * through this module).
 *
 * Invalidated from src/actions/* on the matching mutation — see the Fix 3 commit for the full
 * action-to-tag checklist.
 *
 * A handful of these (noted individually below) also carry a `revalidate: 300` option on top of
 * their tags. Tag invalidation alone only fires when an admin *action* runs — a campaign's own
 * startsAt/endsAt boundary passes with no action to trigger one, so a product's sale badge/price
 * derived from an unstable_cache entry with no time limit would stay wrong indefinitely once a
 * scheduled campaign starts or ends, not just for the page's own ISR window. Note that the page-
 * level `export const revalidate` (the ISR shell timer) does NOT substitute for this: it only
 * controls how often the page's rendered HTML regenerates, and a regeneration that calls back
 * into one of these functions still gets whatever this cache already has until this cache's own
 * timer or a tag invalidation says otherwise — this is Next's Data Cache, a separate layer from
 * the page's Full Route Cache. 300s caps that "nothing invalidated it, nothing will" window; it's
 * cosmetic (checkout and admin always read fresh regardless — ground rules 3/4).
 */

const PRODUCT_CARD_INCLUDE = {
  variants: true,
  images: true,
  tags: { include: { tag: true } },
  category: true,
} as const;

// ---- campaigns ----

export const getActiveCampaigns = unstable_cache(
  async () => {
    const now = new Date();
    return db.campaign.findMany({ where: { active: true, startsAt: { lte: now }, endsAt: { gte: now } } });
  },
  ["public-active-campaigns"],
  // revalidate: this is the literal "is a campaign active right now" query — its own result is
  // the thing that goes stale across a scheduled startsAt/endsAt boundary. See the module doc.
  { tags: ["campaigns"], revalidate: 300 },
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

export const getSpotlightCategories = unstable_cache(
  async () => db.category.findMany({ where: { gender: "MEN" }, orderBy: { position: "asc" }, take: 3 }),
  ["public-spotlight-categories"],
  { tags: ["categories"] },
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
// campaigns), so they get the revalidate: 300 treatment too — see the module doc.
export const getHomeNewProducts = unstable_cache(
  async () =>
    db.product.findMany({
      where: { status: "ACTIVE" },
      include: PRODUCT_CARD_INCLUDE,
      orderBy: { publishedAt: "desc" },
      take: 8,
    }),
  ["public-home-new-products"],
  { tags: ["products"], revalidate: 300 },
);

export function getGenderHubProducts(gender: "MEN" | "WOMEN") {
  return unstable_cache(
    () =>
      db.product.findMany({
        where: { gender: { in: [gender, "UNISEX"] }, status: "ACTIVE" },
        include: PRODUCT_CARD_INCLUDE,
        orderBy: { publishedAt: "desc" },
        take: 8,
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

// No revalidate here: lookbook renders images/links only, no price or sale badge, so it has no
// campaign-boundary staleness risk.
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

// ---- journal ----
// Journal pages call post.publishedAt.toLocaleDateString() directly, so publishedAt is
// re-hydrated to a real Date below after the unstable_cache JSON round-trip turns it into a
// string (see the module-level comment on serialization).

const getPublishedPostsCached = unstable_cache(
  async () => db.post.findMany({ where: { status: "PUBLISHED" }, orderBy: { publishedAt: "desc" } }),
  ["public-published-posts"],
  { tags: ["journal"] },
);

export async function getPublishedPosts() {
  const posts = await getPublishedPostsCached();
  return posts.map((p) => ({ ...p, publishedAt: p.publishedAt ? new Date(p.publishedAt) : null }));
}

export function getCachedPostBySlug(slug: string) {
  return unstable_cache(
    () => db.post.findUnique({ where: { slug, status: "PUBLISHED" } }),
    ["public-post-by-slug", slug],
    { tags: ["journal", `journal:${slug}`] },
  )().then((post) => (post ? { ...post, publishedAt: post.publishedAt ? new Date(post.publishedAt) : null } : post));
}

export async function getAllPublishedPostSlugs(): Promise<string[]> {
  try {
    const posts = await db.post.findMany({ where: { status: "PUBLISHED" }, select: { slug: true } });
    return posts.map((p) => p.slug);
  } catch {
    return [];
  }
}
