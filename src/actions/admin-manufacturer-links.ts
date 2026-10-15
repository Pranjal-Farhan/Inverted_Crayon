"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdminArea } from "@/lib/admin-guard";

async function requireAdmin() {
  return requireAdminArea("products");
}

export type ManufacturerLinkRow = { id: string; url: string; position: number; isCurrentVendor: boolean };
type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Admin-only, per-product notes — almost always a manufacturer page link, never shown to
 * customers. Mirrors the product image rows' pattern (uploadProductImages/reorderProductImages in
 * admin-products.ts): persisted immediately against a real productId, not staged in form state,
 * so it only applies to an already-saved product.
 */
export async function addManufacturerLink(productId: string, url: string): Promise<{ ok: true; link: ManufacturerLinkRow } | { ok: false; error: string }> {
  await requireAdmin();
  const trimmed = url.trim();
  if (!trimmed) return { ok: false, error: "Enter a link first." };

  const product = await db.product.findUnique({ where: { id: productId }, select: { id: true } });
  if (!product) return { ok: false, error: "Product not found — save the product first." };

  const position = await db.manufacturerLink.count({ where: { productId } });
  const link = await db.manufacturerLink.create({ data: { productId, url: trimmed, position } });

  revalidatePath(`/admin/products/${productId}`);
  return { ok: true, link };
}

export async function removeManufacturerLink(id: string): Promise<ActionResult> {
  await requireAdmin();
  const link = await db.manufacturerLink.findUnique({ where: { id }, select: { productId: true } });
  if (!link) return { ok: false, error: "Link not found." };

  await db.manufacturerLink.delete({ where: { id } });
  revalidatePath(`/admin/products/${link.productId}`);
  return { ok: true };
}

/** Exactly one link per product can be the "current vendor" — enforced here (unset every other
 * row, then set this one, in one transaction) rather than a DB constraint, since this is a
 * low-stakes admin-only flag and a transaction is simpler than a partial unique index. */
export async function setCurrentVendor(productId: string, linkId: string): Promise<ActionResult> {
  await requireAdmin();
  const link = await db.manufacturerLink.findUnique({ where: { id: linkId }, select: { productId: true } });
  if (!link || link.productId !== productId) return { ok: false, error: "Link not found." };

  await db.$transaction([
    db.manufacturerLink.updateMany({ where: { productId, isCurrentVendor: true }, data: { isCurrentVendor: false } }),
    db.manufacturerLink.update({ where: { id: linkId }, data: { isCurrentVendor: true } }),
  ]);

  revalidatePath(`/admin/products/${productId}`);
  return { ok: true };
}
