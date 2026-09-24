"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getAdminSession } from "@/lib/session";

export async function createStockOwner(
  _prev: { ok: boolean; error: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error: string }> {
  const session = await getAdminSession();
  if (!session) return { ok: false, error: "Not authorized." };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "Owner name is required." };
  const contact = String(formData.get("contact") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  await db.stockOwner.create({ data: { name, contact, notes } });
  revalidatePath("/admin/finance");
  return { ok: true, error: "" };
}

export async function recordStockPurchase(
  _prev: { ok: boolean; error: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error: string }> {
  const session = await getAdminSession();
  if (!session) return { ok: false, error: "Not authorized." };

  const ownerId = String(formData.get("ownerId") ?? "");
  const variantId = String(formData.get("variantId") ?? "") || null;
  const quantity = Number(formData.get("quantity"));
  const unitCost = Number(formData.get("unitCost"));
  const supplierName = String(formData.get("supplierName") ?? "").trim() || null;
  const purchaseDateRaw = String(formData.get("purchaseDate") ?? "");
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!ownerId) return { ok: false, error: "Select an owner." };
  if (!variantId) return { ok: false, error: "Select a product variant." };
  if (!Number.isFinite(quantity) || quantity <= 0) return { ok: false, error: "Quantity must be greater than zero." };
  if (!Number.isFinite(unitCost) || unitCost < 0) return { ok: false, error: "Unit cost must be zero or more." };

  const owner = await db.stockOwner.findUnique({ where: { id: ownerId } });
  if (!owner) return { ok: false, error: "That owner no longer exists." };

  const variant = await db.variant.findUnique({ where: { id: variantId }, include: { product: true } });
  if (!variant) return { ok: false, error: "That variant no longer exists." };

  const purchaseDate = purchaseDateRaw ? new Date(purchaseDateRaw) : new Date();
  const totalCost = quantity * unitCost;

  await db.$transaction([
    db.stockPurchase.create({
      data: {
        ownerId,
        productId: variant.productId,
        variantId: variant.id,
        productTitleSnapshot: variant.product.title,
        variantLabelSnapshot: `${variant.size} / ${variant.color}`,
        quantity,
        unitCost,
        totalCost,
        supplierName,
        purchaseDate,
        notes,
      },
    }),
    db.variant.update({ where: { id: variant.id }, data: { stockQty: { increment: quantity } } }),
  ]);

  revalidatePath("/admin/finance");
  revalidatePath("/admin/inventory");
  return { ok: true, error: "" };
}
