"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getAdminSession } from "@/lib/session";

async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) throw new Error("Not authorized.");
}

export async function setReviewStatus(id: string, status: "APPROVED" | "REJECTED") {
  await requireAdmin();
  await db.review.update({ where: { id }, data: { status } });
  revalidatePath("/admin/reviews");
}

export async function replyToReview(id: string, reply: string) {
  await requireAdmin();
  await db.review.update({ where: { id }, data: { reply } });
  revalidatePath("/admin/reviews");
}
