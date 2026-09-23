"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { getAdminSession } from "@/lib/session";
import { sendMail } from "@/lib/mail";

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
            stockQty: v.stockQty,
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
  await db.product.delete({ where: { id } });
  revalidatePath("/admin/products");
  redirect("/admin/products");
}
