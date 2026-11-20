import { z } from "zod";
import { APPAREL_SIZES, ONE_SIZE } from "@/lib/sizes";
import { MAX_SIZE_GUIDE_COLUMNS } from "@/lib/size-guide";

// The product form's data shape and its validation rules, in one place that is NOT a "use server"
// file (those can only export async functions). saveProduct (src/actions/admin-products.ts) checks
// every save against productSchema; the JSON importer (src/lib/product-import.ts) checks what it
// builds against the very same schema before anything is written.

export const VALID_SIZES = [...APPAREL_SIZES, ONE_SIZE] as [string, ...string[]];

export const variantSchema = z.object({
  id: z.string().optional(),
  // Only meaningful for a brand-new variant (no id yet) — the client generates an instant
  // title/size/color-derived preview the moment the row is created (ProductEditorForm.tsx);
  // the server re-verifies/disambiguates it (ensureUniqueSku) rather than trusting it outright.
  // Ignored entirely for an existing variant, whose real sku is left untouched on update.
  sku: z.string().trim().min(1, "SKU is required."),
  // The admin editor only ever generates a full color block from APPAREL_SIZES or [ONE_SIZE]
  // (ProductEditorForm.tsx's addColor()/backfillColorGroups()) — this is defense in depth, not
  // the primary guard, against any payload that didn't come from that UI.
  size: z.enum(VALID_SIZES, { message: "Size must be one of S, M, L, XL, XXL, XXXL, or One Size." }),
  color: z.string().trim().min(1, "Color is required."),
  colorHex: z.string().optional(),
  stockQty: z.number().int().min(0),
  lowStockThreshold: z.number().int().min(0).default(5),
  priceOverride: z.number().positive().nullable().optional(),
  preorderAdvanceAmount: z.number().min(0).nullable().optional(),
});

export const productSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(2, "Title must be at least 2 characters."),
  slug: z.string().trim().min(2, "Slug must be at least 2 characters."),
  // The description is three sections on the product page — all optional, to save a draft or to
  // publish. A section left empty is simply not shown on the product page (ProductDescription), so
  // a listing can go up now and be written up later. Mood is also the plain-text summary stored in
  // Product.description, which is "" when Mood is empty.
  mood: z.string().trim().max(2000, "Mood is too long (2000 characters max).").default(""),
  build: z.string().trim().max(2000, "Build is too long (2000 characters max).").default(""),
  howToWear: z.string().trim().max(2000, "How n when to wear is too long (2000 characters max).").default(""),
  categoryId: z.string().min(1, "Select a category."),
  basePrice: z.number().positive(),
  // What one unit costs the business (admin-only; Finance prices cost of goods from it). Left out =
  // "don't touch the saved value", null = clear it. Ignored entirely unless the signed-in account
  // may use Finance — see saveProduct.
  purchaseCost: z.number().min(0, "Purchase cost can't be negative.").max(10_000_000, "Purchase cost is too large.").nullable().optional(),
  // A standing markdown set directly on the product — null discountType means no discount (the
  // "off" state); when set, discountValue must be present too (enforced below, since zod can't
  // express "both or neither" with plain field types).
  discountType: z.enum(["PERCENT", "AMOUNT"]).nullable().default(null),
  discountValue: z.number().positive().nullable().default(null),
  status: z.enum(["DRAFT", "ACTIVE"]),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
  freeDelivery: z.enum(["NONE", "INSIDE_DHAKA", "NATIONWIDE"]).default("NONE"),
  // Per-product shipping override — null keeps the store's default rate for that zone.
  deliveryChargeInsideDhaka: z.number().min(0).nullable().default(null),
  deliveryChargeOutsideDhaka: z.number().min(0).nullable().default(null),
  tagNew: z.boolean().default(false),
  tagPreorder: z.boolean().default(false),
  tagLimited: z.boolean().default(false),
  tagBestseller: z.boolean().default(false),
  // Product-locked coupons valid on this product (see Discount.scope). Anything that isn't
  // actually a product-locked coupon is ignored when saving — global coupons need no attaching.
  couponIds: z.array(z.string()).default([]),
  variants: z.array(variantSchema).min(1),
  sizeGuide: z
    .object({
      columns: z.array(z.string().trim().min(1)).min(1).max(MAX_SIZE_GUIDE_COLUMNS),
      rows: z.array(z.object({ size: z.string().trim().min(1), values: z.array(z.string()) })).min(1),
    })
    .nullable()
    .default(null),
}).superRefine((data, ctx) => {
  if (data.discountType && data.discountValue == null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["discountValue"], message: "Enter a discount amount or percent." });
  }
  if (data.discountType === "PERCENT" && data.discountValue != null && data.discountValue > 100) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["discountValue"], message: "Percent off can't exceed 100." });
  }
  if (data.discountType === "AMOUNT" && data.discountValue != null && data.discountValue >= data.basePrice) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["discountValue"], message: "Amount off must be less than the base price." });
  }
  // Every color must carry exactly the sizes its own mode calls for — no fewer (an incomplete
  // block), no more (a duplicate), and never a mix of apparel sizes and "One Size" under one
  // color. The admin editor can't actually produce anything else (addColor()/backfillColorGroups()
  // always emit a complete, single-mode block), so this only ever fires against a payload that
  // didn't come from that UI.
  const byColor = new Map<string, string[]>();
  for (const v of data.variants) {
    const key = v.color.trim().toLowerCase();
    if (!byColor.has(key)) byColor.set(key, []);
    byColor.get(key)!.push(v.size);
  }
  for (const [colorKey, sizes] of byColor) {
    const isOneSize = sizes.includes(ONE_SIZE);
    const expected: readonly string[] = isOneSize ? [ONE_SIZE] : APPAREL_SIZES;
    const sizeSet = new Set(sizes);
    const matches = sizes.length === expected.length && sizeSet.size === expected.length && expected.every((s) => sizeSet.has(s));
    if (!matches) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: isOneSize
          ? `Color "${colorKey}" must have exactly one "One Size" variant.`
          : `Color "${colorKey}" must have all 6 sizes (S, M, L, XL, XXL, XXXL).`,
      });
    }
  }
});

export type ProductFormInput = z.infer<typeof productSchema>;

export function formatProductValidationError(issues: z.ZodIssue[]) {
  return issues
    .map((issue) => {
      const [field, index] = issue.path;
      if (field === "variants" && typeof index === "number") {
        const variantField = issue.path[2];
        const label = typeof variantField === "string" ? variantField.toUpperCase() : "VALUE";
        return `Variant ${index + 1} ${label}: ${issue.message}`;
      }
      // The description messages already name their section ("Build is too long…"), and the field
      // key (howToWear) isn't what the admin sees on screen — so no prefix.
      if (field === "mood" || field === "build" || field === "howToWear") return issue.message;
      return `${typeof field === "string" ? field : "Product"}: ${issue.message}`;
    })
    .join(" ");
}
