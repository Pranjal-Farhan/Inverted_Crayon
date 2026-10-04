import type { $Enums } from "@/generated/prisma/client";

type OrderStatus = $Enums.OrderStatus;

/** What the admin sees. The fulfillment pipeline is still the full OrderStatus enum underneath
 * (nothing here changes the stored value or the state machine) — this just collapses
 * PENDING/PAID/PROCESSING into the one bucket admins actually act on day to day: an order that
 * hasn't been packed and shipped yet. */
export const ADMIN_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "Not Cleared Yet",
  PAID: "Not Cleared Yet",
  PROCESSING: "Not Cleared Yet",
  SHIPPED: "Sent For Delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
  RETURNED: "Returned",
};

/** Short, badge-sized customer-facing label — order list tables, status pills. */
export const CUSTOMER_STATUS_SHORT: Record<OrderStatus, string> = {
  PENDING: "Processing",
  PAID: "Processing",
  PROCESSING: "Processing",
  SHIPPED: "Dispatched",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
  RETURNED: "Returned",
};

/** The full sentence shown on an order's own detail/tracking view. */
export const CUSTOMER_STATUS_MESSAGE: Record<OrderStatus, string> = {
  PENDING: "Your Order Is Being Processed.",
  PAID: "Your Order Is Being Processed.",
  PROCESSING: "Your Order Is Being Processed.",
  SHIPPED: "Your Order Has Been Dispatched. You Will Receive SMS Containing The Delivery Details Soon.",
  DELIVERED: "Your Order Has Been Delivered. Enjoy!",
  CANCELLED: "This Order Was Cancelled.",
  REFUNDED: "This Order Was Refunded.",
  RETURNED: "This Order Was Returned.",
};

/** Every OrderItem.variantLabelSnapshot is written as "<size> / <color>" (see checkout.ts) —
 * this is the one place that format is parsed back apart for display, so a future change to how
 * it's written only needs updating here too. Falls back gracefully if the shape is ever
 * unexpected (e.g. very old data), rather than mangling the text. */
export function parseVariantLabel(label: string): { size: string; color: string | null } {
  const parts = label.split(" / ");
  if (parts.length === 2) return { size: parts[0], color: parts[1] };
  return { size: label, color: null };
}
