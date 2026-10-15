/**
 * The catalog of every email the site sends — client-safe (no database, no server-only
 * imports) so the admin Templates editor can use it for live previews. What actually gets sent,
 * and when, lives in src/lib/notifications.ts; how an edited body is stored and sent lives in
 * src/lib/messages.ts.
 *
 * Two groups, matching the admin Templates page:
 *   CUSTOMER emails  → to the customer
 *   BRAND emails     → to the official address (Settings → Store → email): what the team is told
 *
 * Only the BODY of a message is editable (that's what the admin asked for). Subjects are fixed
 * here — brand-email subjects carry placeholders so the inbox stays scannable ("New order #IC-… —
 * ৳2,150"). A body can use any of its own `placeholders`, written {like_this}; the save action
 * rejects anything else so a typo can't silently ship as literal "{ordernumber}" text.
 */

export type MessageAudience = "CUSTOMER" | "BRAND";

/** Every placeholder that exists anywhere, with the one-line meaning shown in the editor. */
export const PLACEHOLDERS = {
  // store
  storeName: "Your store's name (Settings → Store)",
  storeEmail: "Your official email (Settings → Store)",
  storePhone: "Your phone number (Settings → Store)",
  siteUrl: "Your website's address",
  // order
  orderNumber: "The order number, e.g. IC-20261015-123456",
  orderDate: "When the order was placed (Dhaka time)",
  orderStatus: "The order's current status",
  paymentMethod: "Cash on delivery, bKash, or card / mobile banking",
  paymentStatus: "Whether it's been paid",
  items: "The items, one per line, with size/colour, quantity and price",
  itemsSummary: "A one-line summary of the items, e.g. 2x Crown Jeans & 1 more item",
  subtotal: "The items' total before discount and delivery",
  discount: "The coupon discount taken off (৳0 if none)",
  couponCode: "The coupon code used (— if none)",
  shippingCost: "The delivery charge",
  total: "The order total",
  shippingAddress: "The delivery address, over two lines",
  shippingZone: "Inside Dhaka or Outside Dhaka",
  location: "Area and district, e.g. Dhanmondi, Dhaka",
  preorderNote: "The preorder line (empty for ordinary orders)",
  nextSteps: "What happens next — 'we'll email you when it ships', or the preorder line",
  receipt: "A full text receipt: items, discount, delivery, total and payment",
  orderUrl: "A link to the order's page on the site",
  adminOrderUrl: "A link to the order in your admin",
  receiptUrl: "A link to the printable receipt in your admin",
  courier: "The courier the order was sent with",
  trackingRef: "The courier's tracking reference",
  // customer
  customerName: "The customer's name",
  customerEmail: "The customer's email",
  customerPhone: "The customer's phone number",
  accountType: "Registered customer, or Guest checkout",
  // events
  message: "The message the customer wrote",
  receivedAt: "When it arrived (Dhaka time)",
  update: "What changed on the order",
  updatedBy: "Which admin made the change",
  updatedAt: "When the change was made (Dhaka time)",
  reason: "The reason the customer gave",
  returnItems: "The items the customer wants to return, one per line",
  signUpMethod: "Email & password, or Google",
  registeredAt: "When the account was created (Dhaka time)",
  claimedOrders: "How many earlier guest orders were linked to the new account",
  accountEmail: "The email of the account that was locked",
  accountRole: "Customer, Admin or Staff",
  attempts: "How many failed attempts triggered the lock",
  lockedUntil: "When the lock lifts (Dhaka time)",
  productName: "The product's name",
  variantLabel: "The size and colour",
  productUrl: "A link to the product page",
  shipDate: "The preorder's ship date",
  stockNow: "Units in stock right now",
} as const;

export type PlaceholderName = keyof typeof PLACEHOLDERS;

const STORE: PlaceholderName[] = ["storeName", "storeEmail", "storePhone", "siteUrl"];
const CUSTOMER: PlaceholderName[] = ["customerName", "customerEmail", "customerPhone", "accountType"];
const ORDER_CORE: PlaceholderName[] = [
  "orderNumber",
  "orderDate",
  "paymentMethod",
  "paymentStatus",
  "items",
  "itemsSummary",
  "subtotal",
  "discount",
  "couponCode",
  "shippingCost",
  "total",
  "shippingAddress",
  "shippingZone",
  "location",
  "preorderNote",
  "receipt",
];
const ADMIN_LINKS: PlaceholderName[] = ["adminOrderUrl", "receiptUrl"];

export type TemplateKey =
  // emails to customers
  | "WELCOME"
  | "ORDER_CONFIRMED"
  | "ORDER_SHIPPED"
  | "ORDER_CANCELLATION_REQUESTED"
  | "ORDER_CANCELLED"
  | "BACK_IN_STOCK"
  | "PREORDER_SHIP_UPDATE"
  | "CONTACT_RECEIVED"
  // emails to the brand
  | "ADMIN_CONTACT_MESSAGE"
  | "ADMIN_NEW_ORDER"
  | "ADMIN_NEW_PREORDER"
  | "ADMIN_ORDER_UPDATE"
  | "ADMIN_CANCELLATION_REQUEST"
  | "ADMIN_ACCOUNT_REGISTERED"
  | "ADMIN_LOGIN_LOCKOUT"
  | "ADMIN_ORDER_DELIVERED"
  | "ADMIN_RETURN_REQUEST"
  | "ADMIN_NOTIFY_ME";

export type TemplateDef = {
  key: TemplateKey;
  audience: MessageAudience;
  title: string;
  /** Plain-language description of exactly when this goes out. */
  when: string;
  /** Emails only. Fixed (not editable); may contain placeholders. */
  subject?: string;
  defaultBody: string;
  placeholders: PlaceholderName[];
};

/** Longest body the editor accepts. */
export const MAX_BODY_LENGTH = 6000;

const BRAND_ORDER_BODY = (heading: string, extra = "") => `${heading}

Order #{orderNumber} · {orderDate}
Payment: {paymentMethod} ({paymentStatus})
Customer: {customerName} · {customerEmail} · {customerPhone} ({accountType})
Ship to:
{shippingAddress}
${extra}
{receipt}

Open in admin: {adminOrderUrl}
Printable receipt: {receiptUrl}`;

export const TEMPLATES: TemplateDef[] = [
  // ------------------------------------------------------------------ emails to customers
  {
    key: "ORDER_CONFIRMED",
    audience: "CUSTOMER",
    title: "Order confirmed",
    when: "Right after a customer places an order.",
    subject: "Order confirmed",
    defaultBody: "Order #{orderNumber} confirmed — {total} via {paymentMethod}. {nextSteps}",
    placeholders: [
      "orderNumber", "orderDate", "paymentMethod", "paymentStatus", "items", "itemsSummary", "subtotal", "discount",
      "couponCode", "shippingCost", "total", "shippingAddress", "location", "preorderNote", "nextSteps", "receipt",
      "orderUrl", "customerName", ...STORE,
    ],
  },
  {
    key: "ORDER_SHIPPED",
    audience: "CUSTOMER",
    title: "Order shipped",
    when: "When an admin marks an order as sent for delivery.",
    subject: "It's shipped",
    defaultBody: "Order #{orderNumber} is on its way via {courier} — tracking ref {trackingRef}.",
    placeholders: ["orderNumber", "courier", "trackingRef", "items", "itemsSummary", "shippingAddress", "orderUrl", "customerName", ...STORE],
  },
  {
    key: "ORDER_CANCELLATION_REQUESTED",
    audience: "CUSTOMER",
    title: "Cancellation request received",
    when: "Right after a customer asks to cancel an order that hasn't shipped (from their account's order page) — an acknowledgement that we got it.",
    subject: "We got your cancellation request",
    defaultBody: `Hi {customerName} — we've received your request to cancel order #{orderNumber} ({itemsSummary}, {total}).

Reason you gave: {reason}

We'll review it and email you as soon as it's confirmed. If the order has already been handed to the courier we may not be able to stop it — we'll tell you either way.

Questions? Just reply to this email or write to {storeEmail}.`,
    placeholders: [
      "orderNumber", "orderDate", "items", "itemsSummary", "subtotal", "discount", "couponCode", "shippingCost", "total",
      "paymentMethod", "paymentStatus", "shippingAddress", "reason", "receipt", "orderUrl", "customerName", ...STORE,
    ],
  },
  {
    key: "ORDER_CANCELLED",
    audience: "CUSTOMER",
    title: "Order cancelled",
    when: "When an order is cancelled by an admin (Cancel order, or a Refund on an unshipped order the customer asked to cancel) — confirms the cancellation to the customer.",
    subject: "Your order has been cancelled",
    defaultBody: `Hi {customerName} — order #{orderNumber} ({itemsSummary}, {total}) has been cancelled.

Nothing more is owed for it. If you had already paid anything towards this order, we'll be in touch about returning it.

Changed your mind? You're always welcome back: {siteUrl}

Questions? Just reply to this email or write to {storeEmail}.`,
    placeholders: [
      "orderNumber", "orderDate", "items", "itemsSummary", "subtotal", "discount", "couponCode", "shippingCost", "total",
      "paymentMethod", "paymentStatus", "shippingAddress", "reason", "receipt", "orderUrl", "customerName", ...STORE,
    ],
  },
  {
    key: "BACK_IN_STOCK",
    audience: "CUSTOMER",
    title: "Back in stock",
    when: "When a sold-out size is restocked — to everyone who clicked “notify me” for it and everyone who wishlisted the product.",
    subject: "Back in stock",
    defaultBody: "{productName} ({variantLabel}) is back — grab it before it's gone again. {productUrl}",
    placeholders: ["productName", "variantLabel", "productUrl", ...STORE],
  },
  {
    key: "PREORDER_SHIP_UPDATE",
    audience: "CUSTOMER",
    title: "Preorder ship date update",
    when: "When an admin sets or changes a preorder product's ship date — to customers with an open preorder for it.",
    subject: "Your preorder ships soon",
    defaultBody: "{productName} now ships {shipDate}. We'll keep you posted if that changes.",
    placeholders: ["productName", "shipDate", "productUrl", ...STORE],
  },
  {
    key: "WELCOME",
    audience: "CUSTOMER",
    title: "Newsletter welcome",
    when: "When someone subscribes to the newsletter with an email that isn't on the list yet.",
    subject: "Stay inverted.",
    defaultBody: "Drops, restocks, nothing boring. You're on the list.",
    placeholders: [...STORE],
  },
  {
    key: "CONTACT_RECEIVED",
    audience: "CUSTOMER",
    title: "Contact form acknowledgement",
    when: "When someone submits the contact form — a receipt for their message.",
    subject: "We got your message",
    defaultBody: "Hey {customerName} — we got it and will reply within 1–2 business days.",
    placeholders: ["customerName", "customerEmail", "message", ...STORE],
  },

  // ------------------------------------------------------------------ emails to the brand
  {
    key: "ADMIN_CONTACT_MESSAGE",
    audience: "BRAND",
    title: "Contact message",
    when: "When a customer sends a message through the contact form.",
    subject: "New contact message from {customerName}",
    defaultBody: `New message from the contact form.

From: {customerName} <{customerEmail}>
Received: {receivedAt}

{message}`,
    placeholders: ["customerName", "customerEmail", "message", "receivedAt", ...STORE],
  },
  {
    key: "ADMIN_NEW_ORDER",
    audience: "BRAND",
    title: "New order",
    when: "When a customer places an order (preorders have their own message below).",
    subject: "New order #{orderNumber} — {total}",
    defaultBody: BRAND_ORDER_BODY("New order received."),
    placeholders: [...ORDER_CORE, ...CUSTOMER, ...ADMIN_LINKS, ...STORE],
  },
  {
    key: "ADMIN_NEW_PREORDER",
    audience: "BRAND",
    title: "New preorder",
    when: "When a customer places an order that includes a preorder item.",
    subject: "New PREORDER #{orderNumber} — {total}",
    defaultBody: BRAND_ORDER_BODY("New PREORDER received.", "\n{preorderNote}\n"),
    placeholders: [...ORDER_CORE, ...CUSTOMER, ...ADMIN_LINKS, ...STORE],
  },
  {
    key: "ADMIN_ORDER_UPDATE",
    audience: "BRAND",
    title: "Order update",
    when: "When an order changes — sent for delivery, refunded, or its cash-on-delivery balance collected. (Delivered has its own message.)",
    subject: "Order #{orderNumber} updated — {update}",
    defaultBody: `Order #{orderNumber} was updated.

Update: {update}
By: {updatedBy}
When: {updatedAt}

Order #{orderNumber} · {orderDate}
Status: {orderStatus} · Payment: {paymentMethod} ({paymentStatus})
Customer: {customerName} · {customerEmail} · {customerPhone} ({accountType})
Ship to:
{shippingAddress}

Items:
{items}
Subtotal: {subtotal} · Shipping: {shippingCost} · Total: {total}

Open in admin: {adminOrderUrl}`,
    placeholders: [
      "orderNumber", "orderDate", "update", "updatedBy", "updatedAt", "orderStatus", "paymentMethod", "paymentStatus",
      "items", "itemsSummary", "subtotal", "discount", "couponCode", "shippingCost", "total", "shippingAddress",
      "receipt", "courier", "trackingRef", ...CUSTOMER, ...ADMIN_LINKS, ...STORE,
    ],
  },
  {
    key: "ADMIN_CANCELLATION_REQUEST",
    audience: "BRAND",
    title: "Cancellation request",
    when: "When a customer asks to cancel an order that hasn't shipped yet (from their account's order page).",
    subject: "Cancellation requested — order #{orderNumber}",
    defaultBody: `A customer asked to cancel an order.

Reason: {reason}

Order #{orderNumber} · {orderDate}
Status: {orderStatus}
Customer: {customerName} · {customerEmail} · {customerPhone} ({accountType})

{receipt}

Review it in admin: {adminOrderUrl}`,
    placeholders: ["reason", "orderStatus", ...ORDER_CORE, ...CUSTOMER, ...ADMIN_LINKS, ...STORE],
  },
  {
    key: "ADMIN_ACCOUNT_REGISTERED",
    audience: "BRAND",
    title: "New account",
    when: "When someone creates a customer account (by email or Google).",
    subject: "New account: {customerName}",
    defaultBody: `A new customer account was created.

Name: {customerName}
Email: {customerEmail}
Phone: {customerPhone}
Signed up with: {signUpMethod}
When: {registeredAt}
Earlier guest orders linked to it: {claimedOrders}`,
    placeholders: ["customerName", "customerEmail", "customerPhone", "signUpMethod", "registeredAt", "claimedOrders", ...STORE],
  },
  {
    key: "ADMIN_LOGIN_LOCKOUT",
    audience: "BRAND",
    title: "Login lockout",
    when: "When repeated wrong passwords lock a customer, admin or staff account.",
    subject: "Account locked: {accountEmail}",
    defaultBody: `The {accountRole} account {accountEmail} was locked after {attempts} failed login attempts.
It unlocks at {lockedUntil}.

If that wasn't the account's owner, someone may be guessing the password.`,
    placeholders: ["accountEmail", "accountRole", "attempts", "lockedUntil", ...STORE],
  },
  {
    key: "ADMIN_ORDER_DELIVERED",
    audience: "BRAND",
    title: "Order delivered",
    when: "When an admin marks an order as delivered.",
    subject: "Order #{orderNumber} delivered",
    defaultBody: `Order #{orderNumber} was marked delivered.

Order #{orderNumber} · {orderDate}
Customer: {customerName} · {customerEmail} · {customerPhone} ({accountType})
Delivered to:
{shippingAddress}

Items:
{items}
Subtotal: {subtotal} · Shipping: {shippingCost} · Total: {total} ({paymentMethod}, {paymentStatus})
Marked by: {updatedBy} at {updatedAt}

Open in admin: {adminOrderUrl}`,
    placeholders: [
      "orderNumber", "orderDate", "total", "subtotal", "discount", "couponCode", "shippingCost", "paymentMethod",
      "paymentStatus", "items", "itemsSummary", "shippingAddress", "receipt", "updatedBy", "updatedAt",
      ...CUSTOMER, ...ADMIN_LINKS, ...STORE,
    ],
  },
  {
    key: "ADMIN_RETURN_REQUEST",
    audience: "BRAND",
    title: "Return request",
    when: "When a customer requests a return on a delivered order.",
    subject: "Return requested — order #{orderNumber}",
    defaultBody: `A customer requested a return.

Items to return:
{returnItems}

Reason: {reason}

Order #{orderNumber} · {orderDate}
Customer: {customerName} · {customerEmail} · {customerPhone}

{receipt}

Review it in admin: {adminOrderUrl}`,
    placeholders: ["returnItems", "reason", ...ORDER_CORE, ...CUSTOMER, ...ADMIN_LINKS, ...STORE],
  },
  {
    key: "ADMIN_NOTIFY_ME",
    audience: "BRAND",
    title: "“Notify me” sign-up",
    when: "When someone asks to be told when a sold-out size is back in stock.",
    subject: "Notify-me sign-up: {productName}",
    defaultBody: `Someone wants to know when this is back in stock.

Product: {productName} ({variantLabel})
Their email: {customerEmail}
Account: {accountType}
In stock right now: {stockNow}

{productUrl}`,
    placeholders: ["productName", "variantLabel", "productUrl", "stockNow", "customerEmail", "accountType", ...STORE],
  },
];

export const TEMPLATE_BY_KEY = Object.fromEntries(TEMPLATES.map((t) => [t.key, t])) as Record<TemplateKey, TemplateDef>;

/** The email-outbox type each email template is logged under (EmailType in the schema). */
export function emailTypeFor(key: TemplateKey): string {
  return key;
}

/** Replaces {placeholders} with values; anything unknown is left exactly as written. */
export function renderTemplate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? vars[name] : match));
}

/** The distinct {names} in `text` that aren't in `allowed` — what the editor refuses to save. */
export function findUnknownPlaceholders(text: string, allowed: readonly string[]): string[] {
  const unknown = new Set<string>();
  for (const m of text.matchAll(/\{(\w+)\}/g)) {
    if (!allowed.includes(m[1])) unknown.add(m[1]);
  }
  return [...unknown];
}

/** Realistic fake values for every placeholder, so the editor can show what a message will look like. */
export const SAMPLE_VALUES: Record<PlaceholderName, string> = {
  storeName: "Inverted Crayon",
  storeEmail: "hello@invertedcrayon.com",
  storePhone: "+880 17725-46800",
  siteUrl: "https://invertedcrayon.com",
  orderNumber: "IC-20261015-123456",
  orderDate: "15 Oct 2026, 14:03",
  orderStatus: "Not cleared yet",
  paymentMethod: "Cash on delivery",
  paymentStatus: "Pending",
  items: "• 2 × Crown Straight Jeans (S / Black) — ৳1,050 each = ৳2,100\n• 1 × Marker Logo Hoodie (M / Lime) — ৳2,450",
  itemsSummary: "2x Crown Straight Jeans & 1 more item",
  subtotal: "৳4,550",
  discount: "৳150",
  couponCode: "INVERT10",
  shippingCost: "৳60",
  total: "৳4,460",
  shippingAddress: "House 12, Road 4, Dhanmondi\nDhaka 1209, Bangladesh",
  shippingZone: "Inside Dhaka",
  location: "Dhanmondi, Dhaka",
  preorderNote: "Preorder Now and Our Sales Agent Will Reach Out.",
  nextSteps: "We'll email you when it ships.",
  receipt:
    "RECEIPT — Inverted Crayon\nOrder #IC-20261015-123456 · 15 Oct 2026, 14:03\nPayment: Cash on delivery · Pending\n\nITEMS\n• 2 × Crown Straight Jeans (S / Black) — ৳1,050 each = ৳2,100\n• 1 × Marker Logo Hoodie (M / Lime) — ৳2,450\n\nSubtotal: ৳4,550\nCoupon INVERT10: −৳150\nShipping (Inside Dhaka): ৳60\nTOTAL: ৳4,460",
  orderUrl: "https://invertedcrayon.com/order/IC-20261015-123456",
  adminOrderUrl: "https://invertedcrayon.com/admin/orders/clx1abc23",
  receiptUrl: "https://invertedcrayon.com/admin/orders/clx1abc23/receipt",
  courier: "Pathao",
  trackingRef: "PT-884213",
  customerName: "Rex O.",
  customerEmail: "rex@example.com",
  customerPhone: "+880 1711-000000",
  accountType: "Registered customer",
  message: "Hi! Do you ship the Crown jeans in size 34?",
  receivedAt: "15 Oct 2026, 14:03",
  update: "Sent for delivery via Pathao",
  updatedBy: "Mitu (Staff)",
  updatedAt: "15 Oct 2026, 14:03",
  reason: "I ordered the wrong size.",
  returnItems: "• 1 × Crown Straight Jeans (S / Black)",
  signUpMethod: "Email & password",
  registeredAt: "15 Oct 2026, 14:03",
  claimedOrders: "1",
  accountEmail: "rex@example.com",
  accountRole: "Customer",
  attempts: "5",
  lockedUntil: "15 Oct 2026, 14:18",
  productName: "Crown Straight Jeans",
  variantLabel: "S / Black",
  productUrl: "https://invertedcrayon.com/product/crown-straight-jeans-men",
  shipDate: "30 Oct",
  stockNow: "0",
};
