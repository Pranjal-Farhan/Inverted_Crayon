"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCustomerSession } from "@/lib/session";
import { notifyCancellationRequested } from "@/lib/notifications";
import { CANCELLABLE_STATUSES } from "@/lib/order-status";

export type CancellationResult = { ok: true } | { ok: false; error: string };

const schema = z.object({
  orderNumber: z.string().min(1),
  reason: z.string().trim().max(500, "Please keep the reason under 500 characters."),
});

/**
 * A customer asks to cancel an order that hasn't shipped yet. This only records the request and
 * tells the team — it never cancels anything itself: an admin reviews it (the request shows on
 * the order's admin page) and decides, since stock, payment and courier state are theirs to judge.
 */
export async function requestOrderCancellation(orderNumber: string, reason: string): Promise<CancellationResult> {
  const session = await getCustomerSession();
  if (!session) return { ok: false, error: "Please log in to request a cancellation." };

  const parsed = schema.safeParse({ orderNumber, reason });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "That didn't go through." };

  // Only their own order — the customerId in the lookup is what stops one customer cancelling another's.
  const order = await db.order.findFirst({ where: { number: parsed.data.orderNumber, customerId: session.customerId } });
  if (!order) return { ok: false, error: "We couldn't find that order." };
  if (!(CANCELLABLE_STATUSES as readonly string[]).includes(order.status)) {
    return { ok: false, error: "This order has already shipped or been closed, so it can't be cancelled from here — contact us and we'll help." };
  }

  // A guarded write, so a double-click can't record (and email) the same request twice.
  const claimed = await db.order.updateMany({
    where: { id: order.id, cancellationRequestedAt: null, status: { in: [...CANCELLABLE_STATUSES] } },
    data: { cancellationRequestedAt: new Date(), cancellationReason: parsed.data.reason || null },
  });
  if (claimed.count > 0) await notifyCancellationRequested(order.id, parsed.data.reason);

  revalidatePath(`/account/orders/${order.number}`);
  revalidatePath(`/admin/orders/${order.id}`);
  return { ok: true };
}
