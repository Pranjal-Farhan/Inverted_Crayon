"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { getCustomerSession } from "@/lib/session";

const schema = z.object({
  productId: z.string().min(1),
  orderNumber: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  body: z.string().min(5),
});

export type ReviewSubmitResult = { ok: true } | { ok: false; error: string };

export async function submitReview(input: z.infer<typeof schema>): Promise<ReviewSubmitResult> {
  const session = await getCustomerSession();
  if (!session) return { ok: false, error: "Log in to write a review." };

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That didn't go through. Check the fields and try again." };
  const data = parsed.data;

  // must actually be a delivered order belonging to this customer, containing this product
  const order = await db.order.findFirst({
    where: { number: data.orderNumber, customerId: session.customerId, status: "DELIVERED" },
    include: { items: true },
  });
  if (!order || !order.items.some((i) => i.productId === data.productId)) {
    return { ok: false, error: "This item isn't eligible for a review yet." };
  }

  const existing = await db.review.findFirst({ where: { productId: data.productId, customerId: session.customerId } });
  if (existing) return { ok: false, error: "You've already reviewed this product." };

  try {
    await db.review.create({
      data: {
        productId: data.productId,
        customerId: session.customerId,
        authorName: session.name ?? "Customer",
        rating: data.rating,
        body: data.body,
        status: "PENDING",
      },
    });
  } catch (e) {
    // The findFirst above is a courtesy check, not the real guard — a concurrent double-submit
    // (double-click, two tabs) can race past it. The @@unique([productId, customerId]) constraint
    // is what actually prevents duplicates; catch its violation and surface the same friendly error.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "You've already reviewed this product." };
    }
    console.error("submitReview failed", e);
    return { ok: false, error: "That didn't go through. Try again in a moment." };
  }

  revalidatePath(`/account/orders/${data.orderNumber}`);
  revalidatePath("/admin/reviews");
  return { ok: true };
}
