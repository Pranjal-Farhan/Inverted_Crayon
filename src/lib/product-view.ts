import { toNumber } from "@/lib/money";
import type { Campaign, Product, ProductImage, ProductTag, Tag, Variant } from "@/generated/prisma/client";

/**
 * Tags are first-class (Build Spec §10, §05). Preorder / New / Limited /
 * Bestseller are stored on ProductTag; Sale is derived from an active
 * Campaign; Sold-out is derived from variant stock. This module is the one
 * place that reacts to that state so every surface (card, PDP, cart,
 * checkout) stays consistent.
 */

export type ProductWithRelations = Product & {
  variants: Variant[];
  images: ProductImage[];
  tags: (ProductTag & { tag: Tag })[];
  category: { id: string; name: string; slug: string };
};

export type ProductDisplay = {
  id: string;
  slug: string;
  title: string;
  gender: Product["gender"];
  categoryName: string;
  categorySlug: string;
  images: ProductImage[];
  basePrice: number;
  salePrice: number | null;
  onSale: boolean;
  isNew: boolean;
  isLimited: boolean;
  isBestseller: boolean;
  isPreorder: boolean;
  preorderShipDate: string | null;
  soldOut: boolean;
  totalStock: number;
  publishedAt: Date | null;
  /** True when at least one variant is out of stock but admin-configured to still sell as a preorder. */
  hasPreorderableVariant: boolean;
};

const NEW_WINDOW_DAYS = 21;

export function findActiveCampaign(
  product: Pick<Product, "id" | "categoryId">,
  campaigns: Campaign[],
  now: Date = new Date(),
): Campaign | undefined {
  return campaigns.find((c) => {
    if (!c.active) return false;
    if (c.startsAt > now || c.endsAt < now) return false;
    if (c.targetProductIds.includes(product.id)) return true;
    if (c.targetCategoryId && c.targetCategoryId === product.categoryId) return true;
    return false;
  });
}

function campaignSalePrice(basePrice: number, campaign: Campaign): number {
  if (campaign.fixedSalePrice != null) return toNumber(campaign.fixedSalePrice);
  if (campaign.percentOff != null) {
    const off = toNumber(campaign.percentOff);
    return Math.round(basePrice * (1 - off / 100) * 100) / 100;
  }
  return basePrice;
}

export function deriveProductDisplay(
  product: ProductWithRelations,
  campaigns: Campaign[],
  now: Date = new Date(),
): ProductDisplay {
  const basePrice = toNumber(product.basePrice);
  const totalStock = product.variants.reduce((sum, v) => sum + v.stockQty, 0);
  const soldOut = product.variants.length > 0 && totalStock === 0;

  const campaign = findActiveCampaign(product, campaigns, now);
  const onSale = Boolean(campaign) && !soldOut;
  const salePrice = campaign ? campaignSalePrice(basePrice, campaign) : null;

  const preorderTag = product.tags.find((t) => t.tag.type === "PREORDER");
  const limitedTag = product.tags.find((t) => t.tag.type === "LIMITED");
  const bestsellerTag = product.tags.find((t) => t.tag.type === "BESTSELLER");
  const newTag = product.tags.find((t) => t.tag.type === "NEW");

  const publishedRecently =
    product.publishedAt != null &&
    now.getTime() - new Date(product.publishedAt).getTime() < NEW_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  const preorderMeta = preorderTag?.meta as { shipDate?: string } | null | undefined;
  const hasPreorderableVariant = product.variants.some(variantPreorderEligible);

  return {
    id: product.id,
    slug: product.slug,
    title: product.title,
    gender: product.gender,
    categoryName: product.category.name,
    categorySlug: product.category.slug,
    images: product.images,
    basePrice,
    salePrice,
    onSale,
    isNew: Boolean(newTag) || publishedRecently,
    isLimited: Boolean(limitedTag),
    isBestseller: Boolean(bestsellerTag),
    isPreorder: Boolean(preorderTag),
    preorderShipDate: preorderMeta?.shipDate ?? null,
    soldOut,
    totalStock,
    publishedAt: product.publishedAt,
    hasPreorderableVariant,
  };
}

export function variantIsSoldOut(variant: Pick<Variant, "stockQty">): boolean {
  return variant.stockQty <= 0;
}

/**
 * Single source of truth for "can this specific out-of-stock size/color still be bought as a
 * preorder" — driven entirely by the admin-set per-variant advance (§ preorder philosophy), not
 * by the product-level Preorder tag. A tag-based pre-launch product's variants become eligible
 * the same way: they start at 0 stock, and the admin sets an advance amount for each of them.
 */
export function variantPreorderEligible(variant: Pick<Variant, "stockQty" | "preorderAdvanceAmount">): boolean {
  return variant.stockQty <= 0 && variant.preorderAdvanceAmount != null;
}

export function variantPrice(product: Pick<Product, "basePrice">, variant: Pick<Variant, "priceOverride">): number {
  return variant.priceOverride != null ? toNumber(variant.priceOverride) : toNumber(product.basePrice);
}
