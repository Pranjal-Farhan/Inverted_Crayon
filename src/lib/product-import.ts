import { z } from "zod";
import { ONE_SIZE, sizesForMode, type SizingMode } from "@/lib/sizes";
import { MAX_SIZE_GUIDE_COLUMNS } from "@/lib/size-guide";
import { slugify } from "@/lib/slugify";
import { formatProductValidationError, productSchema, type ProductFormInput } from "@/lib/product-schema";

/**
 * The JSON product import. This file is the whole of its logic and deliberately knows nothing about
 * the database, the session or Next.js: it takes the text someone pasted, turns each product into
 * exactly what the product form would have saved (`ProductFormInput`), and says — product by
 * product — whether it is ready, already exists, or has problems. The server action
 * (src/actions/admin-product-import.ts) supplies the categories and the "does this slug / SKU
 * already exist" answers, and does the saving through the real `saveProduct`.
 *
 * Imports are always created as Drafts: the owner adds photos in the editor and publishes there.
 */

export const MAX_IMPORT_PRODUCTS = 30;
export const MAX_IMPORT_CHARS = 1_000_000;

type Gender = "MEN" | "WOMEN" | "UNISEX";
export type ImportCategory = { id: string; name: string; slug: string; gender: Gender };

export type ImportContext = {
  /** ADMIN may set purchase cost; STAFF may not (saveProduct ignores it for them, so say so). */
  role: "ADMIN" | "STAFF";
  categories: ImportCategory[];
  /** Which of these slugs / SKUs are already in the store (SKU -> title of the product holding it). */
  findExisting: (
    slugs: string[],
    skus: string[],
  ) => Promise<{ slugs: Map<string, { id: string; title: string }>; skus: Map<string, string> }>;
};

export type ImportSummary = {
  gender: Gender;
  category: string;
  price: number;
  /** What it sells for after the markdown, or null when there is none. */
  salePrice: number | null;
  colors: number;
  variants: number;
  skuFirst: string;
  skuLast: string;
  tags: string[];
  stockTotal: number;
  /** The preorder advance every variant gets: a number, null (none), or "mixed". */
  preorderAdvance: number | null | "mixed";
};

export type ImportItem = {
  index: number;
  title: string;
  slug: string;
  state: "ready" | "exists" | "error";
  errors: string[];
  warnings: string[];
  existing?: { id: string; title: string };
  summary?: ImportSummary;
  /** Only when `state === "ready"`: exactly what saveProduct takes. Never sent to the browser. */
  input?: ProductFormInput;
};

export type ImportAnalysis = { ok: true; items: ImportItem[] } | { ok: false; error: string };

// ---------------------------------------------------------------------------------------------
// The accepted JSON. Strict on purpose: a misspelt field ("salesPrice") must be an error, not a
// product that quietly imports without its discount.

/** "women", "Women", "inside dhaka", "one-size" -> "WOMEN", "INSIDE_DHAKA", "ONE_SIZE". */
const norm = (v: unknown) => (typeof v === "string" ? v.trim().toUpperCase().replace(/[\s-]+/g, "_") : v);

const money = z.number().positive().max(10_000_000);
const count = z.number().int().min(0).max(100_000);

const colorSchema = z.strictObject({
  name: z.string().trim().min(1).max(40),
  hex: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "must look like #C19A6B")
    .optional(),
  /** Short code for this colour's SKUs; defaults to the first three letters/digits of the name. */
  code: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9]{1,8}$/, "letters and digits only, up to 8")
    .optional(),
  /** One number for every size, or per size: { "S": 2, "M": 5 } (sizes left out keep the product's default). */
  stock: z.union([count, z.record(z.string(), count)]).optional(),
  /** Overrides the product's preorder advance for this colour; null = no preorder for it. */
  preorderAdvance: z.number().min(0).max(10_000_000).nullable().optional(),
  /** A different price for this colour. */
  price: money.optional(),
});

const sizeGuideSchema = z.strictObject({
  columns: z.array(z.string().trim().min(1).max(40)).min(1).max(MAX_SIZE_GUIDE_COLUMNS),
  rows: z
    .array(z.strictObject({ size: z.string().trim().min(1).max(20), values: z.array(z.string().max(40)).max(MAX_SIZE_GUIDE_COLUMNS) }))
    .min(1)
    .max(20),
});

const importProductSchema = z.strictObject({
  title: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(2).max(120).optional(),
  gender: z.preprocess(norm, z.enum(["MEN", "WOMEN", "UNISEX"])),
  /** A category's name or slug, within that gender. */
  category: z.string().trim().min(1).max(60),
  price: money,
  /** What it should sell for; becomes an "amount off" markdown. Use this or `discount`. */
  salePrice: money.optional(),
  discount: z.strictObject({ type: z.preprocess(norm, z.enum(["PERCENT", "AMOUNT"])), value: money }).optional(),
  mood: z.string().max(4000).optional(),
  /** Bullets — as a list (we add the "- ") or as text with one "- bullet" per line. */
  build: z.union([z.string().max(4000), z.array(z.string().max(500)).max(30)]).optional(),
  /** Paragraphs — as a list or as text with blank lines between them. */
  howToWear: z.union([z.string().max(4000), z.array(z.string().max(1000)).max(20)]).optional(),
  seoTitle: z.string().trim().max(200).optional(),
  seoDescription: z.string().trim().max(500).optional(),
  tags: z.array(z.preprocess(norm, z.enum(["NEW", "PREORDER", "LIMITED", "BESTSELLER"]))).max(4).optional(),
  freeDelivery: z.preprocess(norm, z.enum(["NONE", "INSIDE_DHAKA", "NATIONWIDE"])).optional(),
  deliveryChargeInsideDhaka: z.number().min(0).max(100_000).nullable().optional(),
  deliveryChargeOutsideDhaka: z.number().min(0).max(100_000).nullable().optional(),
  /** Admins only. */
  purchaseCost: z.number().min(0).max(10_000_000).nullable().optional(),
  sizeGuide: sizeGuideSchema.nullable().optional(),
  /** APPAREL (default: S, M, L, XL, XXL, XXXL for every colour) or ONE_SIZE. */
  sizing: z.preprocess(norm, z.enum(["APPAREL", "ONE_SIZE"])).optional(),
  /** e.g. "SCRIB-{COLOR}-{SIZE}". Default: first six letters of the title + "-{COLOR}-{SIZE}". */
  skuPattern: z
    .string()
    .trim()
    .min(3)
    .max(40)
    .regex(/^[A-Za-z0-9{}-]+$/, "letters, digits, dashes and {COLOR} / {SIZE} only")
    .optional(),
  /** Starting stock for every size of every colour (default 0). */
  stock: count.optional(),
  /** The preorder advance for every variant (0 = reserve free, everything on delivery); null/absent = no preorder. */
  preorderAdvance: z.number().min(0).max(10_000_000).nullable().optional(),
  lowStockThreshold: count.optional(),
  colors: z.array(colorSchema).min(1).max(30),
  /** Accepted but ignored: imports are always Drafts. */
  status: z.preprocess(norm, z.enum(["DRAFT", "ACTIVE"])).optional(),
  /** Accepted but not stored: the product form has no collection field. */
  collection: z.string().max(100).optional(),
});

type ImportProduct = z.infer<typeof importProductSchema>;

// ---------------------------------------------------------------------------------------------
// Reading the pasted text

/** Pasted text -> a list of raw product objects, or a message about what is wrong with it. */
function readProducts(rawText: string): { ok: true; products: unknown[] } | { ok: false; error: string } {
  if (typeof rawText !== "string") return { ok: false, error: "Nothing to import." };
  // Chat apps and editors love to wrap code in ```json fences and to leave a byte-order mark behind.
  let text = rawText.replace(/^﻿/, "").trim();
  text = text.replace(/^```[a-zA-Z]*\s*\n?/, "").replace(/\n?```\s*$/, "").trim();
  if (!text) return { ok: false, error: "Paste the product JSON into the box first." };
  if (text.length > MAX_IMPORT_CHARS) return { ok: false, error: "That's too much text for one import — split it into smaller files." };

  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (e) {
    const detail = e instanceof Error ? e.message : "it couldn't be read";
    const curly = /[“”‘’]/.test(text)
      ? " It contains curly quotes (“ ” ‘ ’) — JSON needs straight quotes (\")."
      : "";
    return { ok: false, error: `That isn't valid JSON: ${detail}.${curly} Check for a missing comma, quote or bracket near that spot.` };
  }

  if (Array.isArray(value)) return { ok: true, products: value };
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (Array.isArray(obj.products)) return { ok: true, products: obj.products };
    if ("title" in obj) return { ok: true, products: [obj] };
  }
  return { ok: false, error: 'Expected {"products": [ … ]}, a list of products, or a single product.' };
}

/** zod's issues, in words a shop owner can act on. */
function describeIssues(issues: z.ZodError["issues"]): string[] {
  return issues.map((issue) => {
    let where = "";
    for (const seg of issue.path) where += typeof seg === "number" ? ` #${seg + 1}` : where ? ` → ${String(seg)}` : String(seg);
    if (issue.code === "unrecognized_keys") {
      const keys = (issue as unknown as { keys: string[] }).keys.map((k) => `"${k}"`).join(", ");
      return `Unknown field ${keys}${where ? ` in ${where}` : ""} — check the spelling.`;
    }
    return where ? `${where}: ${issue.message}` : issue.message;
  });
}

// ---------------------------------------------------------------------------------------------
// One product

const cleanText = (s: string) => s.replace(/\r\n?/g, "\n").trim();

/** Bullets: list items (or lines) each become one "- " line, exactly as the product form expects. */
function bulletText(v: string | string[] | undefined): string {
  if (v === undefined) return "";
  const lines = (Array.isArray(v) ? v : cleanText(v).split("\n")).map(cleanText).filter(Boolean);
  return lines.map((l) => (/^[-•*]\s/.test(l) ? `- ${l.slice(2).trim()}` : `- ${l}`)).join("\n");
}

/** Paragraphs: a list is joined with blank lines; text is used as written. */
function paragraphText(v: string | string[] | undefined): string {
  if (v === undefined) return "";
  return Array.isArray(v) ? v.map(cleanText).filter(Boolean).join("\n\n") : cleanText(v);
}

const SIZE_TOKEN: Record<string, string> = { S: "S", M: "M", L: "L", XL: "XL", XXL: "XXL", XXXL: "XXXL", [ONE_SIZE]: "OS" };

/** The same cleaning the server applies to every SKU (ensureUniqueSkus): A-Z, 0-9 and dashes, 40 characters. */
const cleanSku = (s: string) => s.replace(/[^a-zA-Z0-9-]/g, "").toUpperCase().slice(0, 40);

const round2 = (n: number) => Math.round(n * 100) / 100;

/** "xl", "one size" -> "XL", "One Size". */
function canonicalSize(key: string): string {
  const k = key.trim().toUpperCase().replace(/[\s_-]+/g, " ");
  return k === "ONE SIZE" ? ONE_SIZE : k;
}

type Draft = Omit<ImportItem, "state" | "existing"> & { skus: string[] };

function convertOne(raw: unknown, index: number, ctx: ImportContext): Draft {
  const rawTitle =
    raw && typeof raw === "object" && typeof (raw as { title?: unknown }).title === "string" && (raw as { title: string }).title.trim()
      ? (raw as { title: string }).title.trim().slice(0, 120)
      : `Product ${index + 1}`;
  const draft: Draft = { index, title: rawTitle, slug: "", errors: [], warnings: [], skus: [] };
  const { errors, warnings } = draft;

  const parsed = importProductSchema.safeParse(raw);
  if (!parsed.success) {
    errors.push(...describeIssues(parsed.error.issues));
    return draft;
  }
  const p: ImportProduct = parsed.data;
  draft.title = p.title;

  // ---- slug
  const slug = slugify(p.slug ?? p.title);
  if (slug.length < 2) errors.push("The slug (the product's web address) needs at least 2 letters or digits.");
  else if (p.slug && slug !== p.slug) warnings.push(`The slug was tidied from "${p.slug}" to "${slug}".`);
  draft.slug = slug;

  // ---- category
  const sameGender = ctx.categories.filter((c) => c.gender === p.gender);
  const wanted = p.category.trim().toLowerCase();
  // The name as shown wins; the category's web name (slug) is the fallback — a category that was later
  // renamed in the admin keeps its old slug, so "Outerwear" can still find "Winter-wear".
  const category = sameGender.find((c) => c.name.toLowerCase() === wanted) ?? sameGender.find((c) => c.slug === slugify(p.category));
  if (!category) {
    const have = sameGender.map((c) => c.name).join(", ");
    errors.push(`There is no "${p.category}" category under ${p.gender}.${have ? ` Available: ${have}.` : " That branch has no categories yet."}`);
  } else if (category.name.toLowerCase() !== wanted) {
    warnings.push(`"${p.category}" matched the category called "${category.name}" (its web name is "${category.slug}") — check that's the right shelf.`);
  }

  // ---- price and markdown
  let discountType: "PERCENT" | "AMOUNT" | null = null;
  let discountValue: number | null = null;
  let salePrice: number | null = null;
  if (p.salePrice !== undefined && p.discount) {
    errors.push('Use either "salePrice" or "discount", not both.');
  } else if (p.salePrice !== undefined) {
    if (p.salePrice >= p.price) errors.push(`salePrice (${p.salePrice}) must be lower than price (${p.price}).`);
    else {
      discountType = "AMOUNT";
      discountValue = round2(p.price - p.salePrice);
      salePrice = p.salePrice;
    }
  } else if (p.discount) {
    discountType = p.discount.type;
    discountValue = p.discount.value;
    salePrice = p.discount.type === "PERCENT" ? round2(p.price * (1 - p.discount.value / 100)) : round2(p.price - p.discount.value);
  }

  // ---- things that are accepted but have no effect
  if (p.status === "ACTIVE") warnings.push("status is ignored — imports always create Drafts. Publish from the product's editor once the photos are in.");
  if (p.collection) warnings.push(`collection ("${p.collection}") isn't stored — the product form has no collection field.`);
  if (p.purchaseCost != null && ctx.role !== "ADMIN") warnings.push("purchaseCost is ignored — only an admin account can set it.");

  // ---- sizes, colours, variants
  const sizingMode: SizingMode = p.sizing ?? "APPAREL";
  const sizes = sizesForMode(sizingMode);

  // A duplicate colour name or code already explains any "same SKU" collision that follows, so
  // the SKU check below stays quiet about it rather than repeating the problem.
  let skuClashExplained = false;
  const names = new Set<string>();
  for (const c of p.colors) {
    const key = c.name.trim().toLowerCase();
    if (names.has(key)) {
      errors.push(`Two colours are both called "${c.name}" — each colour can only appear once.`);
      skuClashExplained = true;
    }
    names.add(key);
  }

  const pattern = p.skuPattern ?? `${slugify(p.title).replace(/-/g, "").slice(0, 6).toUpperCase() || "SKU"}-{COLOR}-{SIZE}`;
  const tokens = [...pattern.matchAll(/\{([^}]*)\}/g)].map((m) => m[1].toUpperCase());
  const unknownToken = tokens.find((t) => t !== "COLOR" && t !== "SIZE");
  if (unknownToken !== undefined) errors.push(`skuPattern has an unknown placeholder {${unknownToken}} — use {COLOR} and {SIZE}.`);
  if (!tokens.includes("SIZE") && sizes.length > 1) errors.push("skuPattern needs {SIZE}, or every size of a colour would get the same SKU.");
  if (!tokens.includes("COLOR") && p.colors.length > 1) errors.push("skuPattern needs {COLOR}, or every colour would get the same SKUs.");

  const codes = new Map<string, string>();
  const variants: ProductFormInput["variants"] = [];
  const advances = new Set<number | null>();
  let stockTotal = 0;

  for (const c of p.colors) {
    const code = (c.code ?? c.name.replace(/[^A-Za-z0-9]/g, "").slice(0, 3)).toUpperCase() || "COL";
    const clash = codes.get(code);
    if (clash && clash.toLowerCase() !== c.name.toLowerCase()) {
      errors.push(`"${clash}" and "${c.name}" would both use the SKU code ${code} — give one of them a "code".`);
      skuClashExplained = true;
    }
    codes.set(code, c.name);

    // Stock per size: the colour's own (a number, or per size), else the product's default, else 0.
    const fallbackStock = p.stock ?? 0;
    const perSize: Record<string, number> = {};
    if (typeof c.stock === "object") {
      for (const [key, qty] of Object.entries(c.stock)) {
        const size = canonicalSize(key);
        if (!sizes.includes(size)) errors.push(`${c.name}: "${key}" isn't a size of this product (${sizes.join(", ")}).`);
        else perSize[size] = qty;
      }
    }
    const advance = c.preorderAdvance !== undefined ? c.preorderAdvance : (p.preorderAdvance ?? null);

    for (const size of sizes) {
      const stockQty = typeof c.stock === "number" ? c.stock : (perSize[size] ?? fallbackStock);
      stockTotal += stockQty;
      advances.add(advance);
      const sku = cleanSku(pattern.replace(/\{color\}/gi, code).replace(/\{size\}/gi, SIZE_TOKEN[size] ?? size));
      draft.skus.push(sku);
      variants.push({
        sku,
        size,
        color: c.name,
        colorHex: c.hex ?? "#0c0c0d",
        stockQty,
        lowStockThreshold: p.lowStockThreshold ?? 5,
        priceOverride: c.price ?? null,
        preorderAdvanceAmount: advance,
      });
    }
  }

  const seen = new Set<string>();
  for (const sku of draft.skus) {
    if (seen.has(sku)) {
      if (!skuClashExplained && !unknownToken && (tokens.includes("SIZE") || sizes.length === 1) && (tokens.includes("COLOR") || p.colors.length === 1)) {
        errors.push(`Two variants would get the same SKU (${sku}) — check skuPattern and the colour codes.`);
      }
      break;
    }
    seen.add(sku);
  }

  if (stockTotal === 0 && advances.size === 1 && advances.has(null)) {
    warnings.push("Every size starts at stock 0 and no preorder advance is set, so it will show as sold out until you add stock.");
  }

  if (errors.length || !category) return draft;

  // ---- the form's own data, checked against the form's own rules
  const input: ProductFormInput = {
    title: p.title,
    slug,
    mood: p.mood ? cleanText(p.mood) : "",
    build: bulletText(p.build),
    howToWear: paragraphText(p.howToWear),
    categoryId: category.id,
    basePrice: p.price,
    ...(ctx.role === "ADMIN" && p.purchaseCost !== undefined ? { purchaseCost: p.purchaseCost } : {}),
    discountType,
    discountValue,
    status: "DRAFT",
    seoTitle: p.seoTitle,
    seoDescription: p.seoDescription,
    freeDelivery: p.freeDelivery ?? "NONE",
    deliveryChargeInsideDhaka: p.deliveryChargeInsideDhaka ?? null,
    deliveryChargeOutsideDhaka: p.deliveryChargeOutsideDhaka ?? null,
    tagNew: Boolean(p.tags?.includes("NEW")),
    tagPreorder: Boolean(p.tags?.includes("PREORDER")),
    tagLimited: Boolean(p.tags?.includes("LIMITED")),
    tagBestseller: Boolean(p.tags?.includes("BESTSELLER")),
    couponIds: [],
    variants,
    sizeGuide: p.sizeGuide ?? null,
  };
  const checked = productSchema.safeParse(input);
  if (!checked.success) {
    errors.push(formatProductValidationError(checked.error.issues));
    return draft;
  }

  draft.input = input;
  draft.summary = {
    gender: p.gender,
    category: category.name,
    price: p.price,
    salePrice,
    colors: p.colors.length,
    variants: variants.length,
    skuFirst: draft.skus[0],
    skuLast: draft.skus[draft.skus.length - 1],
    tags: p.tags ?? [],
    stockTotal,
    preorderAdvance: advances.size === 1 ? [...advances][0] : "mixed",
  };
  return draft;
}

// ---------------------------------------------------------------------------------------------
// The whole paste

export async function analyzeImport(rawText: string, ctx: ImportContext): Promise<ImportAnalysis> {
  const read = readProducts(rawText);
  if (!read.ok) return read;
  if (read.products.length === 0) return { ok: false, error: "There are no products in that JSON." };
  if (read.products.length > MAX_IMPORT_PRODUCTS) {
    return { ok: false, error: `That's ${read.products.length} products — import at most ${MAX_IMPORT_PRODUCTS} at a time.` };
  }

  const drafts = read.products.map((raw, i) => convertOne(raw, i, ctx));

  // Duplicates inside the paste itself.
  const firstWithSlug = new Map<string, number>();
  const firstWithSku = new Map<string, number>();
  for (const d of drafts) {
    if (d.slug) {
      const first = firstWithSlug.get(d.slug);
      if (first === undefined) firstWithSlug.set(d.slug, d.index);
      else d.errors.push(`Product #${first + 1} in this paste has the same slug (${d.slug}).`);
    }
    for (const sku of new Set(d.skus)) {
      const first = firstWithSku.get(sku);
      if (first === undefined) firstWithSku.set(sku, d.index);
      else if (first !== d.index) {
        d.errors.push(`SKU ${sku} is also used by product #${first + 1} in this paste.`);
        break;
      }
    }
  }

  // What is already in the store.
  const existing = await ctx.findExisting([...firstWithSlug.keys()], [...firstWithSku.keys()]);

  const items: ImportItem[] = drafts.map((d) => {
    const { skus, input, ...rest } = d;
    const hit = d.slug ? existing.slugs.get(d.slug) : undefined;
    if (hit) return { ...rest, state: "exists", existing: hit, errors: [], warnings: d.warnings };

    const taken = [...new Set(skus)].filter((s) => existing.skus.has(s));
    if (taken.length) {
      const owners = [...new Set(taken.map((s) => existing.skus.get(s)))].slice(0, 3).join('", "');
      rest.errors.push(
        `${taken.length} SKU${taken.length === 1 ? " is" : "s are"} already used by other products (e.g. ${taken[0]}, on "${owners}") — change skuPattern or the colour codes.`,
      );
    }
    const state = rest.errors.length ? "error" : "ready";
    return { ...rest, state, ...(state === "ready" ? { input } : {}) };
  });

  return { ok: true, items };
}

export { IMPORT_EXAMPLE } from "@/lib/product-import-example";
