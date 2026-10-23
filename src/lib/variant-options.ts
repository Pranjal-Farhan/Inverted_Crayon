import "server-only";
import { db } from "@/lib/db";
import { toNumber } from "@/lib/money";
import { variantUnitPrice } from "@/lib/product-view";

/**
 * Every size/colour of every product, shaped for the "pick a product" box used when recording a
 * sale. `search` is a long lowercase blob of EVERYTHING you might remember about a product — name,
 * SKU, size, colour, category, men/women/unisex, tags, status, price, stock level, the description —
 * and the box matches when every word typed appears somewhere in it, so any of those finds it.
 */
export type VariantOption = {
  id: string;
  /** "Crown Jeans — M / Cyan" */
  label: string;
  /** The line under the label: SKU · category · price. */
  sub: string;
  sku: string;
  /** What it sells for right now (variant override, product discount applied). */
  price: number;
  /** Purchase cost — only filled for accounts allowed to see it. */
  cost: number | null;
  stock: number;
  search: string;
};

const GENDER_WORDS = { MEN: "men mens male", WOMEN: "women womens female", UNISEX: "unisex" } as const;
const TAG_WORDS = { NEW: "new", PREORDER: "preorder pre-order", LIMITED: "limited", BESTSELLER: "bestseller best seller" } as const;

export async function loadVariantOptions(opts: { includeCost: boolean }): Promise<VariantOption[]> {
  const variants = await db.variant.findMany({
    include: {
      product: {
        // purchaseCost is left out of every query by default (lib/db.ts) — asked for here, only when allowed.
        omit: { purchaseCost: !opts.includeCost },
        include: { category: { select: { name: true } }, tags: { include: { tag: { select: { type: true } } } } },
      },
    },
    orderBy: [{ product: { title: "asc" } }, { color: "asc" }, { size: "asc" }],
  });

  return variants.map((v) => {
    const p = v.product;
    const price = variantUnitPrice(v, p);
    const stockWords = v.stockQty <= 0 ? "out of stock sold out" : v.stockQty <= v.lowStockThreshold ? "low stock in stock" : "in stock";
    const cost = opts.includeCost && "purchaseCost" in p && p.purchaseCost != null ? toNumber(p.purchaseCost) : null;
    return {
      id: v.id,
      label: `${p.title} — ${v.size} / ${v.color}`,
      sub: `${v.sku} · ${p.category.name} · ৳${Math.round(price).toLocaleString("en-US")}`,
      sku: v.sku,
      price,
      cost,
      stock: v.stockQty,
      search: [
        p.title,
        p.slug.replace(/-/g, " "),
        v.sku,
        v.size,
        v.color,
        p.category.name,
        GENDER_WORDS[p.gender],
        p.tags.map((t) => TAG_WORDS[t.tag.type]).join(" "),
        p.status === "ACTIVE" ? "active live" : "draft hidden",
        String(Math.round(price)),
        String(Math.round(toNumber(p.basePrice))),
        stockWords,
        String(v.stockQty),
        (p.mood ?? p.description).slice(0, 300),
      ]
        .join(" ")
        .toLowerCase(),
    };
  });
}
