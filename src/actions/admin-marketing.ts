"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getAdminSession } from "@/lib/session";
import { sendMail } from "@/lib/mail";
import { formatTaka } from "@/lib/money";
import type { CartLine } from "@/lib/cart-types";

async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) throw new Error("Not authorized.");
}

function reminderBody(lines: Pick<CartLine, "title" | "qty" | "unitPrice">[]): string {
  const total = lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
  const items = lines.map((l) => `${l.title} ×${l.qty}`).join(", ");
  return `You left ${items} in your bag (${formatTaka(total)}). Still there — finish checking out whenever you're ready.`;
}

export async function sendAbandonedReminder(id: string) {
  await requireAdmin();
  const row = await db.abandonedCheckout.findUniqueOrThrow({ where: { id } });
  const lines = row.cartSnapshot as unknown as Pick<CartLine, "title" | "qty" | "unitPrice">[];
  await sendMail({ to: row.email, subject: "You left something behind", body: reminderBody(lines), type: "ABANDONED_CHECKOUT" });
  await db.abandonedCheckout.update({ where: { id }, data: { remindedAt: new Date() } });
  revalidatePath("/admin/campaigns");
}

export async function sendAllAbandonedReminders() {
  await requireAdmin();
  const cutoff = new Date(Date.now() - 60 * 60 * 1000); // 1h old, matches a typical abandoned-cart window
  const rows = await db.abandonedCheckout.findMany({
    where: { remindedAt: null, createdAt: { lte: cutoff } },
  });
  for (const row of rows) {
    const lines = row.cartSnapshot as unknown as Pick<CartLine, "title" | "qty" | "unitPrice">[];
    await sendMail({ to: row.email, subject: "You left something behind", body: reminderBody(lines), type: "ABANDONED_CHECKOUT" });
    await db.abandonedCheckout.update({ where: { id: row.id }, data: { remindedAt: new Date() } });
  }
  revalidatePath("/admin/campaigns");
  return { sent: rows.length };
}
