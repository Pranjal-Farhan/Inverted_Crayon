import "server-only";
import { db } from "@/lib/db";
import { smsProviderConfigured, sendViaSslWireless } from "@/lib/sms-provider";
import { formatTaka, toNumber } from "@/lib/money";
import { getStoreInfo } from "@/lib/store-settings";
import type { $Enums, Order, OrderItem } from "@/generated/prisma/client";

/**
 * Same "always log, optionally really send" pattern as `mail.ts`: every call writes an `SmsLog`
 * row (the outbox, viewable at /admin/sms) unconditionally; when SSL Wireless credentials are set
 * it also actually sends, otherwise it stays mocked so local dev needs no SMS gateway account.
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

type OrderForSms = Order & { items: OrderItem[] };

function summarizeItems(items: OrderItem[]): string {
  if (items.length === 0) return "your order";
  if (items.length <= 2) return items.map((i) => `${i.qty}x ${i.productTitleSnapshot}`).join(", ");
  const [first] = items;
  const restCount = items.length - 1;
  return `${first.qty}x ${first.productTitleSnapshot} & ${restCount} more item${restCount === 1 ? "" : "s"}`;
}

/** COD orders are never partially paid online (§ preorders always require an online advance). */
export function classifyOrderSmsType(order: Order): $Enums.SmsType {
  if (order.paymentMethod === "COD") return "ORDER_CONFIRMED_COD";
  if (order.isPreorder && toNumber(order.balanceDue) > 0) return "ORDER_CONFIRMED_PARTIAL";
  return "ORDER_CONFIRMED_PAID";
}

/** Builds the order-confirmation SMS body — content differs by how the order is (or isn't) paid. */
export function composeOrderConfirmationSms(
  order: OrderForSms,
  storeName: string,
  storePhone: string,
): { type: $Enums.SmsType; body: string } {
  const type = classifyOrderSmsType(order);
  const items = summarizeItems(order.items);
  const location = `${order.shippingArea}, ${order.shippingDistrict}`;

  if (type === "ORDER_CONFIRMED_COD") {
    return {
      type,
      body: `${storeName}: Order #${order.number} confirmed (${items}). Total ${formatTaka(toNumber(order.total))} — pay cash on delivery to ${location}. We'll text you when it ships. Help: ${storePhone}`,
    };
  }

  if (type === "ORDER_CONFIRMED_PARTIAL") {
    return {
      type,
      body: `${storeName}: Order #${order.number} confirmed (${items}, preorder). Paid ${formatTaka(toNumber(order.advanceAmount))} advance — ${formatTaka(toNumber(order.balanceDue))} due cash on delivery to ${location}. Help: ${storePhone}`,
    };
  }

  return {
    type,
    body: `${storeName}: Order #${order.number} confirmed (${items})${order.isPreorder ? " — preorder" : ""}. ${formatTaka(toNumber(order.total))} paid in full. Shipping to ${location}. We'll text you when it ships. Help: ${storePhone}`,
  };
}

/** Fetches the order (with items) and sends its confirmation SMS — the one call site every checkout path shares. */
export async function sendOrderConfirmationSms(orderNumber: string) {
  const [order, storeInfo] = await Promise.all([
    db.order.findUnique({ where: { number: orderNumber }, include: { items: true } }),
    getStoreInfo(),
  ]);
  if (!order) return null;

  const { type, body } = composeOrderConfirmationSms(order, storeInfo.name, storeInfo.phone);

  return sendSms({ to: order.phone, body, type, relatedOrderId: order.number });
}
