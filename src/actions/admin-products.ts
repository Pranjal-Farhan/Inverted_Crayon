"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { getAdminSession } from "@/lib/session";
import { sendMail } from "@/lib/mail";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_FILES_PER_UPLOAD = 12;
const MAX_IMAGES_PER_PRODUCT = 20;
const MAX_TOTAL_UPLOAD_BYTES = 40 * 1024 * 1024;
// SVG is deliberately excluded even though it's an "image/*" type: it can embed <script>, and
// since it's served back from /uploads at its own URL, an uploaded SVG would be stored XSS.
const REJECTED_IMAGE_TYPES = new Set(["image/svg+xml"]);

async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) throw new Error("Not authorized.");
  return session;
}

const variantSchema = z.object({
  id: z.string().optional(),
  sku: z.string().min(1),
  size: z.string().min(1),
  color: z.string().min(1),
  colorHex: z.string().optional(),
  stockQty: z.number().int().min(0),
  lowStockThreshold: z.number().int().min(0).default(5),
  priceOverride: z.number().positive().nullable().optional(),
});

const productSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(2),
  slug: z.string().min(2),
  description: z.string().min(1),
  gender: z.enum(["MEN", "WOMEN", "UNISEX"]),
  categoryId: z.string().min(1),
  basePrice: z.number().positive(),
  status: z.enum(["DRAFT", "ACTIVE"]),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
  freeDelivery: z.enum(["NONE", "INSIDE_DHAKA", "NATIONWIDE"]).default("NONE"),
  collectionIds: z.array(z.string()).default([]),
  tagNew: z.boolean().default(false),
  tagPreorder: z.boolean().default(false),
  preorderShipDate: z.string().optional(),
  tagLimited: z.boolean().default(false),
  tagBestseller: z.boolean().default(false),
  variants: z.array(variantSchema).min(1),
});

export type ProductFormInput = z.infer<typeof productSchema>;
export type ProductSaveResult = { ok: true; id: string } | { ok: false; error: string };

export async function saveProduct(input: ProductFormInput): Promise<ProductSaveResult> {
  await requireAdmin();
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const data = parsed.data;

  const tags = await db.tag.findMany();
  const tagByType = Object.fromEntries(tags.map((t) => [t.type, t]));

  const existing = data.id
    ? await db.product.findUnique({
        where: { id: data.id },
        include: { tags: { include: { tag: true } } },
      })
    : null;
  const wasPreorderTag = existing?.tags.find((t) => t.tag.type === "PREORDER");
  const previousShipDate = (wasPreorderTag?.meta as { shipDate?: string } | null | undefined)?.shipDate;

  try {
    const product = await db.$transaction(async (tx) => {
      const productRecord = await tx.product.upsert({
        where: { id: data.id ?? "__new__" },
        update: {
          title: data.title,
          slug: data.slug,
          description: data.description,
          gender: data.gender,
          categoryId: data.categoryId,
          basePrice: data.basePrice,
          status: data.status,
          seoTitle: data.seoTitle,
          seoDescription: data.seoDescription,
          freeDelivery: data.freeDelivery,
          // Only stamp publishedAt the first time a product goes live —
          // re-saving an already-active product must not re-trigger "New".
          publishedAt:
            data.status === "ACTIVE" ? (existing?.publishedAt ?? new Date()) : null,
        },
        create: {
          title: data.title,
          slug: data.slug,
          description: data.description,
          gender: data.gender,
          categoryId: data.categoryId,
          basePrice: data.basePrice,
          status: data.status,
          seoTitle: data.seoTitle,
          seoDescription: data.seoDescription,
          freeDelivery: data.freeDelivery,
          publishedAt: data.status === "ACTIVE" ? new Date() : null,
        },
      });

      // variants: upsert provided, delete removed
      const keepIds: string[] = [];
      for (const v of data.variants) {
        const record = await tx.variant.upsert({
          where: { id: v.id ?? "__new__" },
          update: {
            sku: v.sku,
            size: v.size,
            color: v.color,
            colorHex: v.colorHex,
            // stockQty deliberately omitted: this form loads stock at page-open time, and a
            // customer purchase (or an inventory-page edit) between then and save would get
            // silently overwritten by that stale value. Stock changes go through the Inventory
            // page's setVariantStock instead; new variants still get their initial count below.
            lowStockThreshold: v.lowStockThreshold,
            priceOverride: v.priceOverride ?? null,
          },
          create: {
            productId: productRecord.id,
            sku: v.sku,
            size: v.size,
            color: v.color,
            colorHex: v.colorHex,
            stockQty: v.stockQty,
            lowStockThreshold: v.lowStockThreshold,
            priceOverride: v.priceOverride ?? null,
          },
        });
        keepIds.push(record.id);
      }
      await tx.variant.deleteMany({ where: { productId: productRecord.id, id: { notIn: keepIds } } });

      // collections
      await tx.productCollection.deleteMany({ where: { productId: productRecord.id } });
      for (const collectionId of data.collectionIds) {
        await tx.productCollection.create({ data: { productId: productRecord.id, collectionId } });
      }

      // tags
      await tx.productTag.deleteMany({ where: { productId: productRecord.id } });
      const tagInserts: { type: string; enabled: boolean; meta?: Record<string, unknown> }[] = [
        { type: "NEW", enabled: data.tagNew },
        { type: "PREORDER", enabled: data.tagPreorder, meta: { shipDate: data.preorderShipDate } },
        { type: "LIMITED", enabled: data.tagLimited },
        { type: "BESTSELLER", enabled: data.tagBestseller },
      ];
      for (const t of tagInserts) {
        if (t.enabled && tagByType[t.type]) {
          await tx.productTag.create({
            data: { productId: productRecord.id, tagId: tagByType[t.type].id, meta: (t.meta ?? undefined) as never },
          });
        }
      }

      return productRecord;
    });

    if (data.tagPreorder && data.preorderShipDate && data.preorderShipDate !== previousShipDate) {
      const affected = await db.orderItem.findMany({
        where: {
          productId: product.id,
          isPreorder: true,
          order: { status: { in: ["PENDING", "PAID", "PROCESSING"] } },
        },
        include: { order: true },
      });
      const emails = [...new Set(affected.map((i) => i.order.email))];
      for (const to of emails) {
        await sendMail({
          to,
          subject: "Your preorder ships soon",
          body: `${product.title} now ships ${data.preorderShipDate}. We'll keep you posted if that changes.`,
          type: "PREORDER_SHIP_UPDATE",
        });
      }
    }

    revalidatePath("/admin/products");
    revalidatePath(`/admin/products/${product.id}`);
    return { ok: true, id: product.id };
  } catch (e) {
    if (e instanceof Error && e.message.includes("Unique constraint")) {
      return { ok: false, error: "That slug or SKU is already in use." };
    }
    return { ok: false, error: "Something went wrong saving this product." };
  }
}

export async function deleteProduct(id: string) {
  await requireAdmin();
  try {
    await db.product.delete({ where: { id } });
  } catch (e) {
    // P2025 = record already gone (double-submit) — deleting is idempotent, just continue.
    if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025")) throw e;
  }
  await fs.rm(path.join(process.cwd(), "public", "uploads", "products", id), { recursive: true, force: true });
  revalidatePath("/admin/products");
  redirect("/admin/products");
}

export type ProductImageRow = { id: string; url: string; alt: string | null; position: number; accentColor: string | null };
export type UploadImagesResult = { ok: true; images: ProductImageRow[] } | { ok: false; error: string };

export async function uploadProductImages(productId: string, formData: FormData): Promise<UploadImagesResult> {
  await requireAdmin();

  const product = await db.product.findUnique({ where: { id: productId }, select: { id: true, title: true } });
  if (!product) return { ok: false, error: "Product not found — save the product first." };

  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { ok: false, error: "No files received." };
  if (files.length > MAX_FILES_PER_UPLOAD) return { ok: false, error: `Upload at most ${MAX_FILES_PER_UPLOAD} images at a time.` };

  const oversized = files.some((f) => f.size > MAX_IMAGE_BYTES);
  if (oversized) return { ok: false, error: "Each image must be under 8MB." };

  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
  if (totalBytes > MAX_TOTAL_UPLOAD_BYTES) return { ok: false, error: "That's too much data in one upload — try fewer images." };

  const imageFiles = files.filter((f) => f.type.startsWith("image/") && !REJECTED_IMAGE_TYPES.has(f.type));
  if (imageFiles.length === 0) return { ok: false, error: "Only JPG, PNG, WEBP, GIF or AVIF images are accepted." };

  let position = await db.productImage.count({ where: { productId } });
  if (position + imageFiles.length > MAX_IMAGES_PER_PRODUCT) {
    return { ok: false, error: `A product can have at most ${MAX_IMAGES_PER_PRODUCT} images (${position} already uploaded).` };
  }

  const dir = path.join(process.cwd(), "public", "uploads", "products", productId);
  await fs.mkdir(dir, { recursive: true });

  const created: ProductImageRow[] = [];
  for (const file of imageFiles) {
    const nameExt = file.name.includes(".") ? file.name.split(".").pop() : null;
    const mimeExt = file.type.split("/")[1]?.split("+")[0];
    const ext = (nameExt || mimeExt || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const filename = `${randomUUID()}.${ext}`;
    await fs.writeFile(path.join(dir, filename), Buffer.from(await file.arrayBuffer()));
    const row = await db.productImage.create({
      data: { productId, url: `/uploads/products/${productId}/${filename}`, alt: product.title, position },
    });
    created.push(row);
    position += 1;
  }

  revalidatePath(`/admin/products/${productId}`);
  revalidatePath("/admin/products");
  return { ok: true, images: created };
}

export async function deleteProductImage(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin();
  const image = await db.productImage.findUnique({ where: { id } });
  if (!image) return { ok: false, error: "Image not found." };

  await db.productImage.delete({ where: { id } });
  if (image.url.startsWith("/uploads/")) {
    await fs.unlink(path.join(process.cwd(), "public", image.url)).catch(() => {});
  }

  revalidatePath(`/admin/products/${image.productId}`);
  revalidatePath("/admin/products");
  return { ok: true };
}
