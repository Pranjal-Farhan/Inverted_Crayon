import "server-only";
import { db } from "@/lib/db";
import { toNumber } from "@/lib/money";
import { variantUnitPrice } from "@/lib/product-view";
import { APPAREL_SIZES, ONE_SIZE } from "@/lib/sizes";

/**
 * The Inventory screen's data: every product with every size/colour and its count, plus what the
 * stock is worth — at what it cost to buy (admins only: the purchase cost is never sent to anyone
 * else) and at what it sells for right now (variant price override, product discount applied).
 */

export type InventoryVariant = {
  id: string;
  sku: string;
  size: string;
  color: string;
  colorHex: string | null;
  stock: number;
  /** At or below this (but above zero) the size counts as low. */
  low: number;
  /** What one unit sells for right now. */
  price: number;
};

export type InventoryProduct = {
  id: string;
  title: string;
  slug: string;
  active: boolean;
  category: string;
  gender: string;
  image: string | null;
  /** Purchase cost of one unit — null when not entered yet, or when the viewer isn't allowed to see it. */
  cost: number | null;
  variants: InventoryVariant[];
  /** Lowercase text of everything you might search a product by. */
  search: string;
};

const SIZE_ORDER: string[] = [...APPAREL_SIZES, ONE_SIZE, "XS"];
const sizeRank = (s: string) => {
  const i = SIZE_ORDER.indexOf(s);
  if (i >= 0) return i;
  const n = parseFloat(s);
  return Number.isFinite(n) ? 100 + n : 1000;
};

const GENDER_WORDS = { MEN: "men mens male", WOMEN: "women womens female", UNISEX: "unisex" } as const;

export async function loadInventory(opts: { includeCost: boolean }): Promise<InventoryProduct[]> {
  const products = await db.product.findMany({
    // purchaseCost is left out of every query by default (lib/db.ts) — asked for here, only when allowed.
    omit: { purchaseCost: !opts.includeCost },
    include: {
      category: { select: { name: true } },
      variants: true,
      tags: { include: { tag: { select: { type: true } } } },
      // First real photo only; legacy inline `data:` rows are skipped (multi-hundred-KB blobs).
      images: {
        where: { url: { not: "" }, NOT: { url: { startsWith: "data:" } } },
        orderBy: { position: "asc" },
        take: 1,
        select: { url: true },
      },
    },
    orderBy: { title: "asc" },
  });

  return products.map((p) => {
    const variants = [...p.variants]
      .sort((a, b) => sizeRank(a.size) - sizeRank(b.size) || a.size.localeCompare(b.size) || a.color.localeCompare(b.color))
      .map<InventoryVariant>((v) => ({
        id: v.id,
        sku: v.sku,
        size: v.size,
        color: v.color,
        colorHex: v.colorHex,
        stock: v.stockQty,
        low: v.lowStockThreshold,
        price: variantUnitPrice(v, p),
      }));
    return {
      id: p.id,
      title: p.title,
      slug: p.slug,
      active: p.status === "ACTIVE",
      category: p.category.name,
      gender: p.gender === "MEN" ? "Men" : p.gender === "WOMEN" ? "Women" : "Unisex",
      image: p.images[0]?.url ?? null,
      cost: opts.includeCost && "purchaseCost" in p && p.purchaseCost != null ? toNumber(p.purchaseCost) : null,
      variants,
      search: [
        p.title,
        p.slug.replace(/-/g, " "),
        p.category.name,
        GENDER_WORDS[p.gender],
        p.status === "ACTIVE" ? "active live" : "draft hidden",
        p.tags.map((t) => t.tag.type.toLowerCase()).join(" "),
        variants.map((v) => `${v.sku} ${v.size} ${v.color}`).join(" "),
      ]
        .join(" ")
        .toLowerCase(),
    };
  });
}

export type StockHistoryRow = {
  id: string;
  at: string;
  variantLabel: string;
  sku: string;
  delta: number;
  after: number;
  reason: string;
  orderNumber: string | null;
  note: string | null;
  by: string | null;
};

export const STOCK_REASON_LABEL: Record<string, string> = {
  OPENING: "Opening count",
  ORDER_PLACED: "Sold (order)",
  ORDER_RESTORED: "Returned to shelf (order)",
  RESTOCK: "Stock added",
  CORRECTION: "Correction",
  VARIANT_REMOVED: "Size removed",
};

/** The latest stock movements of one product (every size), newest first. */
export async function loadStockHistory(productId: string, take = 40): Promise<StockHistoryRow[]> {
  const rows = await db.stockMovement.findMany({
    where: { variant: { productId } },
    orderBy: { createdAt: "desc" },
    take,
  });
  return rows.map((m) => ({
    id: m.id,
    at: m.createdAt.toISOString(),
    variantLabel: m.variantLabel,
    sku: m.sku,
    delta: m.delta,
    after: m.qtyAfter,
    reason: STOCK_REASON_LABEL[m.reason] ?? m.reason,
    orderNumber: m.orderNumber,
    note: m.note,
    by: m.actorEmail,
  }));
}
