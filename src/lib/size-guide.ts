export type SizeGuideRow = { size: string; values: string[] };
export type SizeGuideData = { columns: string[]; rows: SizeGuideRow[] };

/** A reusable, admin-saved size guide (SizeGuideTemplate), importable directly into any
 * product's own Size guide panel instead of retyping the same columns/rows. */
export type SizeGuideTemplateOption = { id: string; name: string; data: SizeGuideData };

export const DEFAULT_SIZE_GUIDE_COLUMNS = ["Chest", "Length", "Sleeve"];

/** Ceiling on how many measurement columns (Chest, Length, Sleeve, Waist, ...) a single size
 * guide table can have — shared by the UI's "+ col" gate and both server-side zod schemas
 * (admin-products.ts, admin-size-guides.ts) so the three can't drift out of sync. */
export const MAX_SIZE_GUIDE_COLUMNS = 12;

/** Narrows a Product.sizeGuide JSON column into a usable table, or null if absent/malformed/empty.
 * There is deliberately no stand-in chart for a product whose guide is null: no measurements entered
 * means no size guide is shown (PDP link hidden, /size-guide says so) — never a made-up table. */
export function parseSizeGuide(value: unknown): SizeGuideData | null {
  if (!value || typeof value !== "object") return null;
  const v = value as { columns?: unknown; rows?: unknown };
  if (!Array.isArray(v.columns) || !Array.isArray(v.rows)) return null;

  const columns = v.columns.filter((c): c is string => typeof c === "string" && c.trim() !== "");
  if (columns.length === 0) return null;

  const rows = v.rows
    .filter((r): r is Record<string, unknown> => typeof r === "object" && r !== null)
    .map((r) => ({
      size: typeof r.size === "string" ? r.size.trim() : "",
      values: Array.isArray(r.values)
        ? r.values.map((x) => (typeof x === "string" ? x : x == null ? "" : String(x)))
        : [],
    }))
    .filter((r) => r.size !== "");
  if (rows.length === 0) return null;

  return { columns, rows };
}
