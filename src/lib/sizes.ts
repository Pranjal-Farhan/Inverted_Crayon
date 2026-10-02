/** The fixed, permanent size scale for apparel products — every apparel product carries
 * exactly these 6 variants (one per color), in this exact order. Nothing adds, removes, or
 * reorders a size row any more; the admin only edits stock/price/preorder per size. */
export const APPAREL_SIZES = ["S", "M", "L", "XL", "XXL", "XXXL"] as const;
export type ApparelSize = (typeof APPAREL_SIZES)[number];

/** The sole size for non-apparel products (bags, beanies, snapbacks, sock sets) — a product is
 * either apparel (the 6 sizes above) or one-size, never a mix. */
export const ONE_SIZE = "One Size";

export type SizingMode = "APPAREL" | "ONE_SIZE";

export function sizesForMode(mode: SizingMode): readonly string[] {
  return mode === "ONE_SIZE" ? [ONE_SIZE] : APPAREL_SIZES;
}

/** Infers a product's sizing mode from whatever sizes its variants actually carry — used to
 * render an existing product's editor/PDP correctly without a dedicated stored field. */
export function detectSizingMode(sizes: Iterable<string>): SizingMode {
  for (const s of sizes) if (s === ONE_SIZE) return "ONE_SIZE";
  return "APPAREL";
}
