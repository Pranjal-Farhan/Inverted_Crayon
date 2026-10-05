import "server-only";
import { revalidateTag } from "next/cache";

/**
 * Centralized tag-invalidation helpers for every mutating action — see src/lib/public-cache.ts
 * for what each tag gates. Used instead of raw revalidateTag() calls so the tag names stay
 * consistent across every action file (the perf task's Fix 3 action→tag checklist is this file's
 * exported function list).
 *
 * Uses `{ expire: 0 }` rather than the stale-while-revalidate "max" profile Next's docs recommend
 * for most content: stock/price-driven badges (sold-out, preorder, sale) must be correct for the
 * very next visitor after an admin change, not just eventually — see ground rule 3 in the perf
 * task brief. This trades a little of the stale-while-revalidate performance benefit for
 * correctness, which is the safer call per ground rule 7.
 */
const NOW = { expire: 0 } as const;

export function invalidateProducts() {
  revalidateTag("products", NOW);
}

/** Call on any change to a specific product (price, stock, tags, images, variants, status, slug). */
export function invalidateProduct(ids: { id?: string | null; slug?: string | null }) {
  revalidateTag("products", NOW);
  if (ids.id) revalidateTag(`product:${ids.id}`, NOW);
  if (ids.slug) revalidateTag(`product:${ids.slug}`, NOW);
}

export function invalidateCategories() {
  revalidateTag("categories", NOW);
}

export function invalidateSettings() {
  revalidateTag("settings", NOW);
}

export function invalidateContent() {
  revalidateTag("content", NOW);
}

export function invalidateCampaigns() {
  revalidateTag("campaigns", NOW);
}

export function invalidateJournal(slug?: string | null) {
  revalidateTag("journal", NOW);
  if (slug) revalidateTag(`journal:${slug}`, NOW);
}

export function invalidateReviews() {
  revalidateTag("reviews", NOW);
}
