import "server-only";
import { formatTaka, toNumber } from "@/lib/money";
import { ADMIN_STATUS_LABEL } from "@/lib/order-status";
import type { Order, OrderItem } from "@/generated/prisma/client";
import type { StoreInfo } from "@/lib/store-settings";

/** Builds the {placeholder} values the message templates (src/lib/message-templates.ts) are rendered with. */

export type OrderWithItems = Order & { items: OrderItem[] };

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  COD: "Cash on delivery",
  BKASH: "bKash",
  SSLCOMMERZ: "Card / mobile banking",
};

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  PAID: "Paid",
  FAILED: "Failed",
  REFUNDED: "Refunded",
};

const SHIPPING_ZONE_LABEL: Record<string, string> = {
  INSIDE_DHAKA: "Inside Dhaka",
  OUTSIDE_DHAKA: "Outside Dhaka",
};

const PREORDER_NOTE = "Preorder Now and Our Sales Agent Will Reach Out.";

/** Every date in a message is shown in Dhaka time — the team and the customers are there, and a
 * server clock (UTC on Vercel) would put "Order placed 08:03" on an order placed at 14:03. */
export function formatDhaka(date: Date): string {
  return date.toLocaleString("en-GB", {
    timeZone: "Asia/Dhaka",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** "2x Crown Jeans & 1 more item" — the one-liner SMS and subject lines use. */
export function summarizeItems(items: Pick<OrderItem, "qty" | "productTitleSnapshot">[]): string {
  if (items.length === 0) return "your order";
  if (items.length <= 2) return items.map((i) => `${i.qty}x ${i.productTitleSnapshot}`).join(", ");
  const [first] = items;
  const restCount = items.length - 1;
  return `${first.qty}x ${first.productTitleSnapshot} & ${restCount} more item${restCount === 1 ? "" : "s"}`;
}

/** One bullet per line: quantity, product, size/colour and price. */
export function itemsList(items: OrderItem[]): string {
  if (items.length === 0) return "—";
  return items
    .map((i) => {
      const unit = formatTaka(toNumber(i.unitPrice));
      const line = formatTaka(toNumber(i.lineTotal));
      return `• ${i.qty} × ${i.productTitleSnapshot} (${i.variantLabelSnapshot}) — ${
        i.qty > 1 ? `${unit} each = ${line}` : line
      }${i.isPreorder ? " [preorder]" : ""}`;
    })
    .join("\n");
}

export function shippingAddressText(order: Order): string {
  return `${order.shippingLine1}, ${order.shippingArea}\n${order.shippingDistrict} ${order.shippingPostcode}, ${order.shippingCountry}`;
}

/** A plain-text receipt — emails here are text-only, so this is the itemised receipt that travels in the body. */
export function receiptText(order: OrderWithItems, storeName: string): string {
  const discount = toNumber(order.discountAmount);
  const shipping = toNumber(order.shippingCost);
  const lines = [
    `RECEIPT — ${storeName}`,
    `Order #${order.number} · ${formatDhaka(order.createdAt)}`,
    `Payment: ${PAYMENT_METHOD_LABEL[order.paymentMethod] ?? order.paymentMethod} · ${PAYMENT_STATUS_LABEL[order.paymentStatus] ?? order.paymentStatus}`,
    "",
    "ITEMS",
    itemsList(order.items),
    "",
    `Subtotal: ${formatTaka(toNumber(order.subtotal))}`,
  ];
  if (order.discountCode) {
    lines.push(
      discount > 0 ? `Coupon ${order.discountCode}: −${formatTaka(discount)}` : `Coupon ${order.discountCode}: free delivery`,
    );
  }
  lines.push(
    `Shipping (${SHIPPING_ZONE_LABEL[order.shippingZone] ?? order.shippingZone}): ${shipping === 0 ? "Free" : formatTaka(shipping)}`,
    `TOTAL: ${formatTaka(toNumber(order.total))}`,
  );
  if (order.isPreorder) lines.push("", PREORDER_NOTE);
  return lines.join("\n");
}

/** Everything an order-related template can refer to. Extra keys are harmless — each template only
 * uses (and the editor only allows) the placeholders it declares. */
export function orderVars(order: OrderWithItems, ctx: { origin: string; store: StoreInfo }): Record<string, string> {
  return {
    orderNumber: order.number,
    orderDate: formatDhaka(order.createdAt),
    orderStatus: ADMIN_STATUS_LABEL[order.status],
    paymentMethod: PAYMENT_METHOD_LABEL[order.paymentMethod] ?? order.paymentMethod,
    paymentStatus: PAYMENT_STATUS_LABEL[order.paymentStatus] ?? order.paymentStatus,
    items: itemsList(order.items),
    itemsSummary: summarizeItems(order.items),
    subtotal: formatTaka(toNumber(order.subtotal)),
    discount: formatTaka(toNumber(order.discountAmount)),
    couponCode: order.discountCode ?? "—",
    shippingCost: formatTaka(toNumber(order.shippingCost)),
    total: formatTaka(toNumber(order.total)),
    shippingAddress: shippingAddressText(order),
    shippingZone: SHIPPING_ZONE_LABEL[order.shippingZone] ?? order.shippingZone,
    location: `${order.shippingArea}, ${order.shippingDistrict}`,
    preorderNote: order.isPreorder ? PREORDER_NOTE : "",
    nextSteps: order.isPreorder ? PREORDER_NOTE : "We'll email you when it ships.",
    receipt: receiptText(order, ctx.store.name),
    orderUrl: `${ctx.origin}/order/${order.number}`,
    adminOrderUrl: `${ctx.origin}/admin/orders/${order.id}`,
    receiptUrl: `${ctx.origin}/admin/orders/${order.id}/receipt`,
    courier: order.trackingCourier ?? "—",
    trackingRef: order.trackingRef ?? "—",
    customerName: order.shippingFullName,
    customerEmail: order.email,
    customerPhone: order.phone,
    accountType: order.customerId ? "Registered customer" : "Guest checkout",
  };
}
