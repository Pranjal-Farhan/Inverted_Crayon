import "server-only";
import { db } from "@/lib/db";
import { smsProviderConfigured, sendViaSslWireless } from "@/lib/sms-provider";
import type { $Enums, Order } from "@/generated/prisma/client";

/**
 * The low-level SMS writer, same "always log, optionally really send" pattern as `mail.ts`: every
 * call writes an `SmsLog` row (the outbox, viewable at /admin/sms) unconditionally; when SSL
 * Wireless credentials are set it also actually sends, otherwise it stays mocked so local dev
 * needs no SMS gateway account. Call sites go through sendTemplatedSms (src/lib/messages.ts).
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

  if (smsProviderConfigured()) {
    try {
      await sendViaSslWireless({ to, body, csmsId: log.id });
    } catch (e) {
      console.error("real SMS send failed", e);
    }
  }

  return log;
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
