"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCustomerSession, setCustomerSession } from "@/lib/session";

async function requireCustomer() {
  const session = await getCustomerSession();
  if (!session) throw new Error("Not authorized.");
  return session;
}

export async function updateProfile(name: string, phone: string) {
  const session = await requireCustomer();
  const customer = await db.customer.update({ where: { id: session.customerId }, data: { name, phone } });
  await setCustomerSession({ customerId: customer.id, email: customer.email, name: customer.name });
  revalidatePath("/account");
}

const addressSchema = z.object({
  id: z.string().optional(),
  fullName: z.string().min(2),
  phone: z.string().min(6),
  line1: z.string().min(4),
  area: z.string().min(2),
  district: z.string().min(2),
  postcode: z.string().min(3),
  country: z.string().min(2),
  isDefault: z.boolean(),
});

export async function saveAddress(input: z.infer<typeof addressSchema>) {
  const session = await requireCustomer();
  const data = addressSchema.parse(input);

  if (data.isDefault) {
    await db.address.updateMany({ where: { customerId: session.customerId }, data: { isDefault: false } });
  }

  await db.address.upsert({
    where: { id: data.id ?? "__new__" },
    update: data,
    create: { ...data, customerId: session.customerId },
  });
  revalidatePath("/account/addresses");
}

export async function deleteAddress(id: string) {
  const session = await requireCustomer();
  await db.address.deleteMany({ where: { id, customerId: session.customerId } });
  revalidatePath("/account/addresses");
}

export async function removeWishlistItem(productId: string) {
  const session = await requireCustomer();
  await db.wishlistItem.deleteMany({ where: { customerId: session.customerId, productId } });
  revalidatePath("/account/wishlist");
}

export async function toggleWishlist(productId: string): Promise<{ inWishlist: boolean }> {
  const session = await getCustomerSession();
  if (!session) throw new Error("Log in to save items.");
  const existing = await db.wishlistItem.findUnique({
    where: { customerId_productId: { customerId: session.customerId, productId } },
  });
  if (existing) {
    await db.wishlistItem.delete({ where: { id: existing.id } });
    revalidatePath("/account/wishlist");
    return { inWishlist: false };
  }
  await db.wishlistItem.create({ data: { customerId: session.customerId, productId } });
  revalidatePath("/account/wishlist");
  return { inWishlist: true };
}

const returnSchema = z.object({
  orderId: z.string().min(1),
  orderItemIds: z.array(z.string()).min(1),
  reason: z.string().min(1),
});

export async function requestReturn(input: z.infer<typeof returnSchema>) {
  const session = await requireCustomer();
  const data = returnSchema.parse(input);

  const order = await db.order.findFirst({ where: { id: data.orderId, customerId: session.customerId } });
  if (!order) throw new Error("Order not found.");

  await db.returnRequest.create({
    data: {
      orderId: data.orderId,
      customerId: session.customerId,
      reason: data.reason,
      items: { create: data.orderItemIds.map((orderItemId) => ({ orderItemId, qty: 1 })) },
    },
  });
  revalidatePath("/account/returns");
}
