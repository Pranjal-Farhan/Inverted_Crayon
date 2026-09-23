"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { formatTaka, toNumber } from "@/lib/money";
import { generateOrderNumber } from "@/lib/order-number";
import { validateDiscountCode } from "@/lib/discount";
import { getShippingRates } from "@/lib/store-settings";
import { getCustomerSession } from "@/lib/session";
import { findActiveCampaign } from "@/lib/product-view";
import { sendMail } from "@/lib/mail";

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
  paymentMethod: z.enum(["BKASH", "NAGAD", "SSLCOMMERZ", "COD"]),
  promoCode: z.string().nullable().optional(),
  preorderShipMode: z.enum(["together", "split"]).default("together"),
  lines: z
    .array(z.object({ variantId: z.string().min(1), qty: z.number().int().positive() }))
    .min(1),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type CheckoutResult =
  | { ok: true; orderNumber: string }
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

  let discountAmount = 0;
  let freeShipping = false;
  let appliedCode: string | null = null;
  if (data.promoCode) {
    const session = await getCustomerSession();
    let isFirstOrder = true;
    if (session?.customerId) {
      isFirstOrder = (await db.order.count({ where: { customerId: session.customerId } })) === 0;
    }
    const result = await validateDiscountCode(data.promoCode, subtotal, isFirstOrder);
    if (result.ok) {
      discountAmount = result.amount;
      freeShipping = result.discount.type === "FREE_SHIPPING";
      appliedCode = result.discount.code;
    }
  }

  const shippingCost = freeShipping ? 0 : rates[data.shippingZone].cost;
  const total = Math.max(subtotal - discountAmount + shippingCost, 0);

  const session = await getCustomerSession();
  const orderNumber = generateOrderNumber();

  await db.$transaction(async (tx) => {
    await tx.order.create({
      data: {
        number: orderNumber,
        email: data.email,
        phone: data.phone,
        customerId: session?.customerId,
        status: data.paymentMethod === "COD" ? "PENDING" : "PAID",
        subtotal,
        shippingCost,
        discountAmount,
        total,
        paymentMethod: data.paymentMethod,
        paymentStatus: data.paymentMethod === "COD" ? "PENDING" : "PAID",
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

    for (const item of orderItemsData) {
      if (!item.isPreorder) {
        await tx.variant.update({
          where: { id: item.variantId },
          data: { stockQty: { decrement: item.qty } },
        });
      }
    }

    if (appliedCode) {
      await tx.discount.update({ where: { code: appliedCode }, data: { usedCount: { increment: 1 } } });
    }

    await tx.abandonedCheckout.deleteMany({ where: { email: data.email } });
  });

  await sendMail({
    to: data.email,
    subject: "Order confirmed",
    body: `Order #${orderNumber} confirmed — ${formatTaka(total)}. ${
      hasPreorder ? "Includes a preorder item; we'll email you if the ship date moves." : "We'll email you when it ships."
    }`,
    type: "ORDER_CONFIRMED",
    relatedOrderId: orderNumber,
  });

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
