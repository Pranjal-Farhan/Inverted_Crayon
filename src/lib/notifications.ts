import "server-only";
import { db } from "@/lib/db";
import { classifyOrderSmsType } from "@/lib/sms";
import { getMessageContext, sendTemplatedEmail, sendTemplatedSms } from "@/lib/messages";
import { formatDhaka, itemsList, orderVars } from "@/lib/message-vars";
import { buildReceiptPdf, type ReceiptOrder } from "@/lib/receipt-pdf";
import type { EmailAttachment } from "@/lib/email-provider";
import type { StoreInfo } from "@/lib/store-settings";
import type { TemplateKey } from "@/lib/message-templates";

/**
 * WHEN each email and SMS goes out. Every function here is called from the place the event
 * happens (checkout, an admin action, a signup) and is safe to `await` without a try/catch —
 * sending is best-effort and never throws (see messages.ts). WHAT each message says is the
 * admin-editable template in src/lib/message-templates.ts; this file only supplies the values.
 *
 * Three audiences: the customer (email and/or SMS), and the brand's official address.
 */

type AdminActor = { name: string | null; email: string; role: "ADMIN" | "STAFF" };

/** "Mitu (Staff)" — who did something, for the brand's order-update emails. */
export function actorLabel(actor: AdminActor): string {
  return `${actor.name ?? actor.email} (${actor.role === "ADMIN" ? "Admin" : "Staff"})`;
}

async function loadOrder(where: { id: string } | { number: string }) {
  return db.order.findUnique({ where, include: { items: true } });
}

/**
 * The order's receipt as a PDF, ready to attach to the order emails (to the customer and to the
 * official address). Built once per event and shared by every email that carries it. If the PDF
 * can't be built the emails still go out, just without it — a receipt must never block a message.
 */
async function receiptAttachments(order: ReceiptOrder, store: StoreInfo): Promise<EmailAttachment[]> {
  try {
    const content = await buildReceiptPdf(order, store);
    return [{ filename: `Receipt-${order.number}.pdf`, content, contentType: "application/pdf" }];
  } catch (e) {
    console.error(`[notifications] receipt PDF for ${order.number} failed — sending without it`, e);
    return [];
  }
}

// ---------------------------------------------------------------------------- orders

/** A new order (or preorder) was placed: confirm to the customer, tell the brand, text the customer. */
export async function notifyOrderPlaced(orderNumber: string) {
  const [order, ctx] = await Promise.all([loadOrder({ number: orderNumber }), getMessageContext()]);
  if (!order) return;
  const vars = orderVars(order, ctx);
  const attachments = await receiptAttachments(order, ctx.store);

  // Independent of each other, so sent together — with a real mail server each send is a network
  // round trip, and the customer is waiting on the checkout page for all of them.
  await Promise.all([
    sendTemplatedEmail({ key: "ORDER_CONFIRMED", to: order.email, vars, relatedOrderId: order.number, attachments }),
    sendTemplatedEmail({
      key: order.isPreorder ? "ADMIN_NEW_PREORDER" : "ADMIN_NEW_ORDER",
      vars,
      relatedOrderId: order.number,
      attachments,
    }),
    sendTemplatedSms({
      key: `SMS_${classifyOrderSmsType(order)}` as Extract<TemplateKey, `SMS_${string}`>,
      to: order.phone,
      vars,
      relatedOrderId: order.number,
    }),
  ]);
}

/** An admin marked the order as sent for delivery: tell the customer (email + SMS) and the brand. */
export async function notifyOrderShipped(orderId: string, actor: AdminActor) {
  const [order, ctx] = await Promise.all([loadOrder({ id: orderId }), getMessageContext()]);
  if (!order) return;
  const vars = orderVars(order, ctx);
  const attachments = await receiptAttachments(order, ctx.store);

  await Promise.all([
    sendTemplatedEmail({ key: "ORDER_SHIPPED", to: order.email, vars, relatedOrderId: order.number, attachments }),
    sendTemplatedSms({ key: "SMS_ORDER_SHIPPED", to: order.phone, vars, relatedOrderId: order.number }),
    sendTemplatedEmail({
      key: "ADMIN_ORDER_UPDATE",
      vars: {
        ...vars,
        update: `Sent for delivery via ${order.trackingCourier ?? "courier"}, tracking ${order.trackingRef ?? "—"}`,
        updatedBy: actorLabel(actor),
        updatedAt: formatDhaka(new Date()),
      },
      relatedOrderId: order.number,
      attachments,
    }),
  ]);
}

/** An admin marked the order delivered — the brand hears about it (the customer isn't messaged). */
export async function notifyOrderDelivered(orderId: string, actor: AdminActor) {
  const [order, ctx] = await Promise.all([loadOrder({ id: orderId }), getMessageContext()]);
  if (!order) return;
  await sendTemplatedEmail({
    key: "ADMIN_ORDER_DELIVERED",
    vars: { ...orderVars(order, ctx), updatedBy: actorLabel(actor), updatedAt: formatDhaka(new Date()) },
    relatedOrderId: order.number,
    attachments: await receiptAttachments(order, ctx.store),
  });
}

/** Any other change to an order (refund, COD balance collected) — a short note to the brand. */
export async function notifyOrderUpdated(orderId: string, update: string, actor: AdminActor) {
  const [order, ctx] = await Promise.all([loadOrder({ id: orderId }), getMessageContext()]);
  if (!order) return;
  await sendTemplatedEmail({
    key: "ADMIN_ORDER_UPDATE",
    vars: { ...orderVars(order, ctx), update, updatedBy: actorLabel(actor), updatedAt: formatDhaka(new Date()) },
    relatedOrderId: order.number,
    attachments: await receiptAttachments(order, ctx.store),
  });
}

/** A customer asked to cancel an order that hasn't shipped: acknowledge to them, tell the brand. */
export async function notifyCancellationRequested(orderId: string, reason: string) {
  const [order, ctx] = await Promise.all([loadOrder({ id: orderId }), getMessageContext()]);
  if (!order) return;
  const vars = { ...orderVars(order, ctx), reason: reason.trim() || "No reason given" };
  const attachments = await receiptAttachments(order, ctx.store);
  await Promise.all([
    sendTemplatedEmail({ key: "ORDER_CANCELLATION_REQUESTED", to: order.email, vars, relatedOrderId: order.number, attachments }),
    sendTemplatedEmail({ key: "ADMIN_CANCELLATION_REQUEST", vars, relatedOrderId: order.number, attachments }),
  ]);
}

/**
 * An order was cancelled by an admin: confirm it to the customer (with the receipt, which now says
 * Cancelled) and tell the brand what changed. {reason} is what the customer wrote when they asked
 * to cancel, if they did.
 */
export async function notifyOrderCancelled(orderId: string, update: string, actor: AdminActor) {
  const [order, ctx] = await Promise.all([loadOrder({ id: orderId }), getMessageContext()]);
  if (!order) return;
  const vars = { ...orderVars(order, ctx), reason: order.cancellationReason?.trim() || "No reason given" };
  const attachments = await receiptAttachments(order, ctx.store);
  await Promise.all([
    sendTemplatedEmail({ key: "ORDER_CANCELLED", to: order.email, vars, relatedOrderId: order.number, attachments }),
    sendTemplatedEmail({
      key: "ADMIN_ORDER_UPDATE",
      vars: { ...vars, update, updatedBy: actorLabel(actor), updatedAt: formatDhaka(new Date()) },
      relatedOrderId: order.number,
      attachments,
    }),
  ]);
}

/** A customer asked to return some items from a delivered order. */
export async function notifyReturnRequested(orderId: string, orderItemIds: string[], reason: string) {
  const [order, ctx] = await Promise.all([loadOrder({ id: orderId }), getMessageContext()]);
  if (!order) return;
  const returned = order.items.filter((i) => orderItemIds.includes(i.id));
  await sendTemplatedEmail({
    key: "ADMIN_RETURN_REQUEST",
    vars: { ...orderVars(order, ctx), returnItems: itemsList(returned), reason: reason.trim() || "No reason given" },
    relatedOrderId: order.number,
    attachments: await receiptAttachments(order, ctx.store),
  });
}

// ---------------------------------------------------------------------------- contact, newsletter, notify-me

/** Contact form: acknowledge to the sender, and forward the message to the brand. */
export async function notifyContactMessage(input: { name: string; email: string; message: string }) {
  const vars = {
    customerName: input.name,
    customerEmail: input.email,
    message: input.message,
    receivedAt: formatDhaka(new Date()),
  };
  await sendTemplatedEmail({ key: "CONTACT_RECEIVED", to: input.email, vars });
  await sendTemplatedEmail({ key: "ADMIN_CONTACT_MESSAGE", vars });
}

/** Someone joined the newsletter. */
export async function notifyNewsletterSignup(email: string) {
  await sendTemplatedEmail({ key: "WELCOME", to: email, vars: { customerEmail: email } });
}

/** Someone asked to be told when a sold-out size is back — the brand sees what's being asked for. */
export async function notifyNotifyMeSignup(input: { email: string; variantId: string; hasAccount: boolean }) {
  const [variant, ctx] = await Promise.all([
    db.variant.findUnique({ where: { id: input.variantId }, include: { product: { select: { title: true, slug: true } } } }),
    getMessageContext(),
  ]);
  if (!variant) return;
  await sendTemplatedEmail({
    key: "ADMIN_NOTIFY_ME",
    vars: {
      productName: variant.product.title,
      variantLabel: `${variant.size} / ${variant.color}`,
      productUrl: `${ctx.origin}/product/${variant.product.slug}`,
      stockNow: String(variant.stockQty),
      customerEmail: input.email,
      accountType: input.hasAccount ? "Registered customer" : "Guest",
    },
  });
}

// ---------------------------------------------------------------------------- restocks and preorders

/** One customer's "it's back" email — `productSlug` builds the link. */
export async function notifyBackInStock(input: { to: string; productName: string; productSlug: string; variantLabel: string }) {
  const { origin } = await getMessageContext();
  await sendTemplatedEmail({
    key: "BACK_IN_STOCK",
    to: input.to,
    vars: {
      productName: input.productName,
      variantLabel: input.variantLabel,
      productUrl: `${origin}/product/${input.productSlug}`,
    },
  });
}

/** One customer's "your preorder's ship date changed" email. */
export async function notifyPreorderShipDate(input: { to: string; productName: string; productSlug: string; shipDate: string }) {
  const { origin } = await getMessageContext();
  await sendTemplatedEmail({
    key: "PREORDER_SHIP_UPDATE",
    to: input.to,
    vars: { productName: input.productName, shipDate: input.shipDate, productUrl: `${origin}/product/${input.productSlug}` },
  });
}

// ---------------------------------------------------------------------------- accounts and security

/** A customer account was created: tell the brand, and (when we have their phone) text the customer. */
export async function notifyAccountRegistered(input: {
  name: string | null;
  email: string;
  phone: string | null;
  method: "Email & password" | "Google" | "Facebook";
  claimedOrders: number;
}) {
  const name = input.name ?? input.email;
  await sendTemplatedEmail({
    key: "ADMIN_ACCOUNT_REGISTERED",
    vars: {
      customerName: name,
      customerEmail: input.email,
      customerPhone: input.phone ?? "Not given",
      signUpMethod: input.method,
      registeredAt: formatDhaka(new Date()),
      claimedOrders: String(input.claimedOrders),
    },
  });
  await sendTemplatedSms({ key: "SMS_ACCOUNT_REGISTERED", to: input.phone, vars: { customerName: name } });
}

/** An account was locked by repeated failed logins — sent once, at the moment the lock starts. */
export async function notifyLoginLockout(input: {
  email: string;
  role: "Customer" | "Admin" | "Staff";
  attempts: number;
  lockedUntil: Date;
}) {
  await sendTemplatedEmail({
    key: "ADMIN_LOGIN_LOCKOUT",
    vars: {
      accountEmail: input.email,
      accountRole: input.role,
      attempts: String(input.attempts),
      lockedUntil: formatDhaka(input.lockedUntil),
    },
  });
}
