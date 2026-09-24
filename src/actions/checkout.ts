"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { formatTaka, toNumber } from "@/lib/money";
import { generateOrderNumber } from "@/lib/order-number";
import { validateDiscountCode } from "@/lib/discount";
import { getShippingRates } from "@/lib/store-settings";
import { getCustomerSession } from "@/lib/session";
import { findActiveCampaign } from "@/lib/product-view";
import { sendMail } from "@/lib/mail";
import { sendOrderConfirmationSms } from "@/lib/sms";
import { getSiteOrigin } from "@/lib/site-url";
import { restockAndCancelOrder } from "@/lib/payments/rollback";
import { bkashConfigured, createBkashPayment } from "@/lib/payments/bkash";
import { sslcommerzConfigured, initSslcommerzSession } from "@/lib/payments/sslcommerz";

const MAX_ORDER_NUMBER_ATTEMPTS = 5;
const MIN_PREORDER_ADVANCE_PERCENT = 20;

/** Thrown inside the checkout transaction for expected, user-facing failures (stock/discount raced out from under this order) — rolls back and surfaces as a normal error, not a crash. */
class CheckoutConflictError extends Error {}

const checkoutSchema = z.object({
  email: z.email(),
  phone: z.string().min(6),
  shipping: z.object({
    fullName: z.string().min(2),
    phone: z.string().min(6),
    line1: z.string().min(4),
    area: z.string().min(2),
    district: z.string().min(2),
    postcode: z.string().min(3),
    country: z.string().min(2),
  }),
  shippingZone: z.enum(["INSIDE_DHAKA", "OUTSIDE_DHAKA", "INTERNATIONAL"]),
  paymentMethod: z.enum(["BKASH", "SSLCOMMERZ", "COD"]),
  promoCode: z.string().nullable().optional(),
  preorderShipMode: z.enum(["together", "split"]).default("together"),
  // Preorder-only: % of the total paid online now (20-100); the rest is COD at delivery.
  advancePercent: z.number().int().min(MIN_PREORDER_ADVANCE_PERCENT).max(100).optional(),
  lines: z
    .array(z.object({ variantId: z.string().min(1), qty: z.number().int().positive() }))
    .min(1),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type CheckoutResult =
  | { ok: true; orderNumber: string; redirectUrl?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export async function placeOrder(input: CheckoutInput): Promise<CheckoutResult> {
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "That didn't go through. Check the fields in red and try again." };
  }
  const data = parsed.data;

  const variants = await db.variant.findMany({
    where: { id: { in: data.lines.map((l) => l.variantId) } },
    include: { product: { include: { tags: { include: { tag: true } } } } },
  });
  if (variants.length !== data.lines.length) {
    return { ok: false, error: "Something in your bag is no longer available." };
  }

  const now = new Date();
  const campaigns = await db.campaign.findMany({
    where: { active: true, startsAt: { lte: now }, endsAt: { gte: now } },
  });

  const rates = await getShippingRates();

  let subtotal = 0;
  let hasPreorder = false;
  const orderItemsData: {
    productId: string;
    variantId: string;
    productTitleSnapshot: string;
    variantLabelSnapshot: string;
    qty: number;
    unitPrice: number;
    lineTotal: number;
    isPreorder: boolean;
  }[] = [];

  for (const line of data.lines) {
    const variant = variants.find((v) => v.id === line.variantId)!;
    const product = variant.product;
    const isPreorder = product.tags.some((t) => t.tag.type === "PREORDER");

    if (!isPreorder && variant.stockQty < line.qty) {
      return { ok: false, error: `Not enough stock for ${product.title} (${variant.size}/${variant.color}).` };
    }

    const campaign = findActiveCampaign(product, campaigns, now);
    const base = variant.priceOverride != null ? toNumber(variant.priceOverride) : toNumber(product.basePrice);
    const unitPrice =
      campaign && (campaign.fixedSalePrice != null || campaign.percentOff != null)
        ? campaign.fixedSalePrice != null
          ? toNumber(campaign.fixedSalePrice)
          : Math.round(base * (1 - toNumber(campaign.percentOff!) / 100) * 100) / 100
        : base;

    const lineTotal = Math.round(unitPrice * line.qty * 100) / 100;
    subtotal += lineTotal;
    hasPreorder = hasPreorder || isPreorder;

    orderItemsData.push({
      productId: product.id,
      variantId: variant.id,
      productTitleSnapshot: product.title,
      variantLabelSnapshot: `${variant.size} / ${variant.color}`,
      qty: line.qty,
      unitPrice,
      lineTotal,
      isPreorder,
    });
  }
  subtotal = Math.round(subtotal * 100) / 100;

  if (hasPreorder && data.paymentMethod === "COD") {
    return {
      ok: false,
      error: "Preorders need an online advance payment (bKash or card) — the rest is collected on delivery.",
    };
  }

  const session = await getCustomerSession();

  let discountAmount = 0;
  let freeShipping = false;
  let appliedCode: string | null = null;
  let appliedUsageLimit: number | null = null;
  if (data.promoCode) {
    let isFirstOrder = true;
    if (session?.customerId) {
      isFirstOrder = (await db.order.count({ where: { customerId: session.customerId } })) === 0;
    } else {
      // Guest checkout: no session to key off, so fall back to order history for this email —
      // otherwise anyone can reuse a first-order-only code indefinitely by simply staying logged out.
      isFirstOrder = (await db.order.count({ where: { email: data.email } })) === 0;
    }
    const result = await validateDiscountCode(data.promoCode, subtotal, isFirstOrder);
    if (result.ok) {
      discountAmount = result.amount;
      freeShipping = result.discount.type === "FREE_SHIPPING";
      appliedCode = result.discount.code;
      appliedUsageLimit = result.discount.usageLimit;
    }
  }

  const shippingCost = freeShipping ? 0 : rates[data.shippingZone].cost;
  const total = Math.max(Math.round((subtotal - discountAmount + shippingCost) * 100) / 100, 0);

  // Non-preorder orders are always "paid in full online" (advancePercent effectively 100).
  const advancePercent = hasPreorder ? (data.advancePercent ?? 100) : 100;
  const advanceAmount = Math.round(total * (advancePercent / 100) * 100) / 100;
  const balanceDue = Math.max(Math.round((total - advanceAmount) * 100) / 100, 0);

  // Only redirect to a real gateway when that gateway is actually configured — otherwise fall
  // back to the app's existing mocked instant-paid behavior (unchanged from before this
  // integration existed), so local dev keeps working with zero external credentials.
  const usesLiveGateway =
    (data.paymentMethod === "BKASH" && bkashConfigured()) ||
    (data.paymentMethod === "SSLCOMMERZ" && sslcommerzConfigured());
  const initialStatus = data.paymentMethod === "COD" || usesLiveGateway ? "PENDING" : "PAID";

  let orderNumber = "";
  let succeeded = false;

  for (let attempt = 1; attempt <= MAX_ORDER_NUMBER_ATTEMPTS && !succeeded; attempt++) {
    orderNumber = generateOrderNumber();
    try {
      await db.$transaction(async (tx) => {
        // Guarded, atomic decrement: only succeeds if enough stock is still there at write time.
        // Without the `gte` guard, two concurrent checkouts for the last unit could both pass the
        // earlier read-time check and both commit a decrement, overselling.
        for (const item of orderItemsData) {
          if (!item.isPreorder) {
            const updated = await tx.variant.updateMany({
              where: { id: item.variantId, stockQty: { gte: item.qty } },
              data: { stockQty: { decrement: item.qty } },
            });
            if (updated.count === 0) {
              throw new CheckoutConflictError(
                `Not enough stock left for ${item.productTitleSnapshot} (${item.variantLabelSnapshot}). Update your bag and try again.`,
              );
            }
          }
        }

        // Same guarded-update pattern for usage-limited codes, so two concurrent redemptions of
        // the last slot can't both slip through.
        if (appliedCode) {
          if (appliedUsageLimit != null) {
            const updated = await tx.discount.updateMany({
              where: { code: appliedCode, usedCount: { lt: appliedUsageLimit } },
              data: { usedCount: { increment: 1 } },
            });
            if (updated.count === 0) {
              throw new CheckoutConflictError("That promo code just reached its redemption limit. Remove it and try again.");
            }
          } else {
            await tx.discount.update({ where: { code: appliedCode }, data: { usedCount: { increment: 1 } } });
          }
        }

        await tx.order.create({
          data: {
            number: orderNumber,
            email: data.email,
            phone: data.phone,
            customerId: session?.customerId,
            status: initialStatus,
            subtotal,
            shippingCost,
            discountAmount,
            total,
            paymentMethod: data.paymentMethod,
            paymentStatus: initialStatus === "PAID" ? "PAID" : "PENDING",
            advancePercent: hasPreorder ? advancePercent : null,
            advanceAmount,
            balanceDue,
            shippingZone: data.shippingZone,
            shippingFullName: data.shipping.fullName,
            shippingPhone: data.shipping.phone,
            shippingLine1: data.shipping.line1,
            shippingArea: data.shipping.area,
            shippingDistrict: data.shipping.district,
            shippingPostcode: data.shipping.postcode,
            shippingCountry: data.shipping.country,
            isPreorder: hasPreorder,
            preorderShipMode: hasPreorder ? data.preorderShipMode : null,
            discountCode: appliedCode,
            items: { create: orderItemsData },
          },
        });

        await tx.abandonedCheckout.deleteMany({ where: { email: data.email } });
      });
      succeeded = true;
    } catch (e) {
      if (e instanceof CheckoutConflictError) {
        return { ok: false, error: e.message };
      }
      const isOrderNumberCollision =
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002" &&
        (e.meta?.target as string[] | undefined)?.includes("number");
      if (!isOrderNumberCollision || attempt === MAX_ORDER_NUMBER_ATTEMPTS) {
        console.error("placeOrder failed", e);
        return { ok: false, error: "We couldn't complete your order just now. Please try again — you have not been charged." };
      }
      // else: order-number collision with attempts left — loop retries with a freshly generated number.
    }
  }

  if (usesLiveGateway) {
    const order = await db.order.findUniqueOrThrow({ where: { number: orderNumber } });
    try {
      const origin = await getSiteOrigin();
      if (data.paymentMethod === "BKASH") {
        const { bkashURL, paymentID } = await createBkashPayment({
          amount: advanceAmount,
          orderNumber,
          callbackURL: `${origin}/api/payments/bkash/callback`,
        });
        await db.order.update({ where: { id: order.id }, data: { paymentTransactionId: paymentID } });
        return { ok: true, orderNumber, redirectUrl: bkashURL };
      } else {
        const { gatewayPageURL } = await initSslcommerzSession({
          amount: advanceAmount,
          orderNumber,
          customerName: data.shipping.fullName,
          customerEmail: data.email,
          customerPhone: data.phone,
          customerAddress: data.shipping.line1,
          successUrl: `${origin}/api/payments/sslcommerz/success`,
          failUrl: `${origin}/api/payments/sslcommerz/fail`,
          cancelUrl: `${origin}/api/payments/sslcommerz/cancel`,
        });
        return { ok: true, orderNumber, redirectUrl: gatewayPageURL };
      }
    } catch (e) {
      console.error("payment gateway session init failed", e);
      await restockAndCancelOrder(order.id);
      return { ok: false, error: "Payment couldn't be started right now. Please try again." };
    }
  }

  await sendMail({
    to: data.email,
    subject: "Order confirmed",
    body: `Order #${orderNumber} confirmed — ${formatTaka(advanceAmount)}${
      balanceDue > 0 ? ` now, ${formatTaka(balanceDue)} due on delivery` : ""
    }. ${hasPreorder ? "Includes a preorder item; we'll email you if the ship date moves." : "We'll email you when it ships."}`,
    type: "ORDER_CONFIRMED",
    relatedOrderId: orderNumber,
  }).catch((e) => console.error("order-confirmation email failed", e));

  await sendOrderConfirmationSms(orderNumber).catch((e) => console.error("order-confirmation SMS failed", e));

  return { ok: true, orderNumber };
}

const captureSchema = z.object({
  email: z.email(),
  lines: z.array(
    z.object({ title: z.string(), size: z.string(), color: z.string(), qty: z.number(), unitPrice: z.number() }),
  ),
});

/** Captured on checkout's contact-step blur — the standard "abandoned cart" hook point. */
export async function captureAbandonedCheckout(input: z.infer<typeof captureSchema>) {
  const parsed = captureSchema.safeParse(input);
  if (!parsed.success || parsed.data.lines.length === 0) return;

  const hasOrder = await db.order.findFirst({ where: { email: parsed.data.email } });
  if (hasOrder) return; // returning customer mid-checkout, not actually abandoning

  await db.abandonedCheckout.upsert({
    where: { email: parsed.data.email },
    update: { cartSnapshot: parsed.data.lines, remindedAt: null },
    create: { email: parsed.data.email, cartSnapshot: parsed.data.lines },
  });
}
