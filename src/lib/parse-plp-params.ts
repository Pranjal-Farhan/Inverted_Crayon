import type { PLPParams, PLPSort, PriceBand, PLPTag } from "@/lib/plp";
import type { RawSearchParams } from "@/lib/plp-url";

const SORTS: PLPSort[] = ["newest", "price-asc", "price-desc", "bestselling"];
const BANDS: PriceBand[] = ["under2k", "2k-3k", "3kplus"];
const TAGS: PLPTag[] = ["preorder", "sale", "new", "limited", "bestseller"];

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export function parsePLPParams(raw: RawSearchParams): Omit<PLPParams, "gender" | "categorySlug" | "collectionSlug"> {
  const sizes = first(raw.sizes)?.split(",").filter(Boolean);
  const colors = first(raw.colors)?.split(",").filter(Boolean);
  const priceBand = first(raw.price);
  const tag = first(raw.tag);
  const sort = first(raw.sort);
  const page = Number(first(raw.page) ?? "1");

  return {
    sizes: sizes?.length ? sizes : undefined,
    colors: colors?.length ? colors : undefined,
    priceBand: BANDS.includes(priceBand as PriceBand) ? (priceBand as PriceBand) : undefined,
    tag: TAGS.includes(tag as PLPTag) ? (tag as PLPTag) : undefined,
    inStockOnly: first(raw.stock) === "1",
    sort: SORTS.includes(sort as PLPSort) ? (sort as PLPSort) : undefined,
    q: first(raw.q),
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}
