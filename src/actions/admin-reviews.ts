"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getAdminSession } from "@/lib/session";
import { invalidateReviews } from "@/lib/invalidate";

async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) throw new Error("Not authorized.");
}

export async function setReviewStatus(id: string, status: "APPROVED" | "REJECTED") {
  await requireAdmin();
  await db.review.update({ where: { id }, data: { status } });
  revalidatePath("/admin/reviews");
  // Reviews are embedded in the product page's own cache (not a separately-cached read) — see
  // the "reviews" tag on getCachedProductForPDP in src/lib/get-product.ts.
  invalidateReviews();
}

export async function replyToReview(id: string, reply: string) {
  await requireAdmin();
  await db.review.update({ where: { id }, data: { reply } });
  revalidatePath("/admin/reviews");
  invalidateReviews();
}
