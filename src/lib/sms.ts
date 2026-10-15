import "server-only";
import { db } from "@/lib/db";
import { smsProviderConfigured, sendSmsMessage } from "@/lib/sms-provider";
import type { $Enums, Order } from "@/generated/prisma/client";

/**
 * The low-level SMS writer, same "always log, optionally really send" pattern as `mail.ts`: every
 * call writes an `SmsLog` row (the outbox, viewable at /admin/sms) unconditionally. When SSL
 * Wireless credentials are set it also actually sends and records the outcome on the row — SENT
 * (with the gateway's own reference), or FAILED with the reason; without them it stays mocked
 * (LOGGED), so local dev needs no SMS gateway account. A gateway problem never throws into the
 * order/signup/admin action that triggered the text. Call sites go through sendTemplatedSms
 * (src/lib/messages.ts).
 */
export async function sendSms({
  to,
  body,
  type,
  relatedOrderId,
}: {
  to: string;
  body: string;
  type: $Enums.SmsType;
  relatedOrderId?: string;
}) {
  const log = await db.smsLog.create({ data: { to, body, type, relatedOrderId } });

  if (!smsProviderConfigured()) return log;

  try {
    const { providerRef } = await sendSmsMessage({ to, body, reference: log.id });
    return await db.smsLog.update({ where: { id: log.id }, data: { delivery: "SENT", providerRef } });
  } catch (e) {
    console.error("real SMS send failed", e);
    const message = e instanceof Error ? e.message : String(e);
    return await db.smsLog
      .update({ where: { id: log.id }, data: { delivery: "FAILED", deliveryError: message.slice(0, 500) } })
      .catch(() => log);
  }
}

/**
 * Which order-confirmation SMS an order gets. Preorder takes priority over payment method — it
 * always gets the reservation framing, not a plain COD message, since no advance/balance split is
 * charged or quoted any more: a preorder just confirms, and a sales agent follows up directly.
 */
export function classifyOrderSmsType(order: Order): "ORDER_CONFIRMED_PAID" | "ORDER_CONFIRMED_COD" | "ORDER_CONFIRMED_PARTIAL" {
  if (order.isPreorder) return "ORDER_CONFIRMED_PARTIAL";
  if (order.paymentMethod === "COD") return "ORDER_CONFIRMED_COD";
  return "ORDER_CONFIRMED_PAID";
}
