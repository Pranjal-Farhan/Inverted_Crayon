"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { getAdminForArea } from "@/lib/admin-guard";
import { invalidateProduct } from "@/lib/invalidate";
import { entryDate, todayDhaka } from "@/lib/finance-dates";
import { toNumber } from "@/lib/money";

export async function createStockOwner(
  _prev: { ok: boolean; error: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error: string }> {
  if (!(await getAdminForArea("finance"))) return { ok: false, error: "Not authorized." };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "Owner name is required." };
  const contact = String(formData.get("contact") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  await db.stockOwner.create({ data: { name, contact, notes } });
  revalidatePath("/admin/finance");
  return { ok: true, error: "" };
}

// ================================================================================ shared

type Result = { ok: boolean; error: string };
const OK: Result = { ok: true, error: "" };
const fail = (error: string): Result => ({ ok: false, error });

/** Every finance page reads from the same tables, so any change refreshes the whole section. */
const refresh = () => revalidatePath("/admin/finance", "layout");

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date.");
const money = (label: string) =>
  z.coerce.number({ error: `${label} must be a number.` }).finite().min(0, `${label} can't be negative.`).max(1_000_000_000, `${label} is too large.`);
const methodSchema = z.enum(["CASH", "BKASH", "NAGAD", "BANK", "CARD", "OTHER"], { error: "Pick how it was paid." });
const text = (max: number) => z.string().trim().max(max);
const optional = (max: number) => text(max).transform((v) => v || null);

const firstError = (e: z.ZodError) => e.issues[0]?.message ?? "Check the form and try again.";

async function requireFinance() {
  return getAdminForArea("finance");
}

// ================================================================================ expenses

const expenseSchema = z.object({
  id: z.string().optional(),
  date: day,
  amount: money("Amount").refine((n) => n > 0, "Amount must be more than zero."),
  category: text(60).min(1, "Choose or type a category."),
  title: text(140).min(1, "Say what it was for."),
  paidTo: optional(120),
  method: methodSchema,
  // The owner who made the payment — blank for "not recorded" / paid from the business account.
  ownerId: z.preprocess((v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : null), z.string().nullable()),
  notes: optional(500),
});

export async function saveExpense(_prev: Result | null, formData: FormData): Promise<Result> {
  const admin = await requireFinance();
  if (!admin) return fail("Not authorized.");
  const parsed = expenseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(firstError(parsed.error));
  const { id, date, ...rest } = parsed.data;
  if (rest.ownerId && !(await db.stockOwner.findUnique({ where: { id: rest.ownerId }, select: { id: true } }))) return fail("That owner no longer exists.");
  const data = { ...rest, date: entryDate(date) };
  if (id) {
    const found = await db.expense.updateMany({ where: { id }, data });
    if (found.count === 0) return fail("That expense no longer exists.");
  } else {
    await db.expense.create({ data: { ...data, createdByEmail: admin.email } });
  }
  refresh();
  return OK;
}

export async function deleteExpense(id: string): Promise<Result> {
  return deleteExpenses([id]);
}

export async function deleteExpenses(ids: string[]): Promise<Result> {
  if (!(await requireFinance())) return fail("Not authorized.");
  await db.expense.deleteMany({ where: { id: { in: ids } } });
  refresh();
  return OK;
}

// ================================================================================ investments
//
// An investment is a stock shipment an owner paid for: items (variant, quantity, what each unit
// cost) plus the shipment's own cost. Recording one puts the units on the shelf; editing or
// deleting it takes them back off — with the same guarded decrement the stock stepper uses, so
// units that have already been sold can't be taken off twice.

const shipmentSchema = z.object({
  id: z.string().optional(),
  date: day,
  ownerId: z.string().min(1, "Choose the owner who paid."),
  supplierName: optional(120),
  description: optional(140),
  method: methodSchema,
  notes: optional(500),
  shipmentCost: money("Shipment cost"),
  /** Also save each product's cost from this shipment as its purchase cost (otherwise only products with none yet get it). */
  updateProductCosts: z.boolean().default(false),
  items: z
    .array(
      z.object({
        variantId: z.string().min(1, "Choose a product for every line."),
        quantity: z.coerce.number({ error: "Quantity must be a number." }).int("Quantity must be a whole number.").min(1, "Quantity must be at least 1.").max(1_000_000),
        unitCost: money("Cost each"),
      }),
    )
    .min(1, "Add at least one product to the shipment."),
});

export type ShipmentInput = z.input<typeof shipmentSchema>;

/** A refusal raised inside the transaction (rolls everything back) with a message for the admin. */
class ShipmentError extends Error {}

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function saveInvestment(input: ShipmentInput): Promise<Result> {
  const admin = await requireFinance();
  if (!admin) return fail("Not authorized.");
  const parsed = shipmentSchema.safeParse(input);
  if (!parsed.success) return fail(firstError(parsed.error));
  const d = parsed.data;

  if (!(await db.stockOwner.findUnique({ where: { id: d.ownerId }, select: { id: true } }))) return fail("That owner no longer exists.");

  // The same variant on two lines is one line: quantities add up, the unit cost is their weighted average.
  const merged = new Map<string, { quantity: number; total: number }>();
  for (const it of d.items) {
    const m = merged.get(it.variantId) ?? { quantity: 0, total: 0 };
    m.quantity += it.quantity;
    m.total += it.quantity * it.unitCost;
    merged.set(it.variantId, m);
  }
  const variants = await db.variant.findMany({
    where: { id: { in: [...merged.keys()] } },
    // purchaseCost is asked for explicitly — it is left out of every query by default (lib/db.ts).
    include: { product: { select: { id: true, slug: true, title: true, purchaseCost: true } } },
  });
  if (variants.length !== merged.size) return fail("One of the products no longer exists — remove that line and try again.");

  // In the order they were entered (the database returns variants in its own order).
  const variantById = new Map(variants.map((v) => [v.id, v]));
  const lines = [...merged.entries()].map(([id, m]) => {
    const unitCost = round2(m.total / m.quantity);
    return { variant: variantById.get(id)!, quantity: m.quantity, unitCost, lineTotal: round2(m.quantity * unitCost) };
  });
  const goods = lines.reduce((t, l) => t + l.lineTotal, 0);
  const amount = round2(goods + d.shipmentCost);

  // Product purchase cost: this shipment's average cost per product. It fills a product that has none
  // yet; with the box ticked it replaces the one it has.
  const perProduct = new Map<string, { qty: number; total: number; current: number | null }>();
  for (const l of lines) {
    const e = perProduct.get(l.variant.productId) ?? { qty: 0, total: 0, current: l.variant.product.purchaseCost != null ? toNumber(l.variant.product.purchaseCost) : null };
    e.qty += l.quantity;
    e.total += l.lineTotal;
    perProduct.set(l.variant.productId, e);
  }

  try {
    await db.$transaction(async (tx) => {
      // Net change to each variant's stock: this shipment's units, minus what the shipment added before when editing.
      const delta = new Map<string, number>();
      for (const l of lines) delta.set(l.variant.id, l.quantity);
      if (d.id) {
        const before = await tx.investment.findUnique({ where: { id: d.id }, include: { items: true } });
        if (!before) throw new ShipmentError("That investment no longer exists.");
        if (before.legacyCapital) throw new ShipmentError("This is an old entry from before investments tracked shipments — delete it instead.");
        for (const it of before.items) if (it.variantId) delta.set(it.variantId, (delta.get(it.variantId) ?? 0) - it.quantity);
      }
      for (const [variantId, change] of delta) {
        if (change === 0) continue;
        if (change > 0) {
          await tx.variant.update({ where: { id: variantId }, data: { stockQty: { increment: change } } });
        } else {
          const taken = await tx.variant.updateMany({ where: { id: variantId, stockQty: { gte: -change } }, data: { stockQty: { decrement: -change } } });
          if (taken.count === 0) {
            const v = await tx.variant.findUnique({ where: { id: variantId }, select: { size: true, color: true, product: { select: { title: true } } } });
            throw new ShipmentError(`${v?.product.title ?? "A product"} (${v?.size} / ${v?.color}): this change takes ${-change} units off the shelf, but fewer than that are in stock — some were sold. Correct the stock first.`);
          }
        }
      }

      const data = {
        date: entryDate(d.date),
        amount,
        shipmentCost: d.shipmentCost,
        ownerId: d.ownerId,
        supplierName: d.supplierName,
        description: d.description,
        method: d.method,
        notes: d.notes,
      };
      const items = lines.map((l) => ({
        productId: l.variant.productId,
        variantId: l.variant.id,
        productTitleSnapshot: l.variant.product.title,
        variantLabelSnapshot: `${l.variant.size} / ${l.variant.color}`,
        quantity: l.quantity,
        unitCost: l.unitCost,
        lineTotal: l.lineTotal,
      }));
      if (d.id) {
        await tx.investmentItem.deleteMany({ where: { investmentId: d.id } });
        await tx.investment.update({ where: { id: d.id }, data: { ...data, items: { create: items } } });
      } else {
        await tx.investment.create({ data: { ...data, createdByEmail: admin.email, items: { create: items } } });
      }

      for (const [productId, e] of perProduct) {
        if (e.current != null && !d.updateProductCosts) continue;
        await tx.product.update({ where: { id: productId }, data: { purchaseCost: round2(e.total / e.qty) } });
      }
    });
  } catch (e) {
    if (e instanceof ShipmentError) return fail(e.message);
    throw e;
  }

  refresh();
  for (const l of lines) invalidateProduct({ id: l.variant.product.id, slug: l.variant.product.slug });
  return OK;
}

export async function deleteInvestment(id: string): Promise<Result> {
  return deleteInvestments([id]);
}

/** Each shipment is handled on its own: the ones that can go, go (their units come back off the shelf); the ones with units already sold are reported. */
export async function deleteInvestments(ids: string[]): Promise<Result> {
  if (!(await requireFinance())) return fail("Not authorized.");
  const problems: string[] = [];
  let deleted = 0;
  for (const id of ids) {
    const inv = await db.investment.findUnique({ where: { id }, include: { items: { include: { variant: { select: { product: { select: { id: true, slug: true } } } } } } } });
    if (!inv) continue;
    try {
      await db.$transaction(async (tx) => {
        if (!inv.legacyCapital) {
          for (const it of inv.items) {
            if (!it.variantId) continue;
            const taken = await tx.variant.updateMany({ where: { id: it.variantId, stockQty: { gte: it.quantity } }, data: { stockQty: { decrement: it.quantity } } });
            if (taken.count === 0) throw new ShipmentError(`${it.productTitleSnapshot} (${it.variantLabelSnapshot}): this shipment added ${it.quantity} units, but fewer than that are in stock now — some were sold.`);
          }
        }
        await tx.investment.delete({ where: { id } });
      });
    } catch (e) {
      if (e instanceof ShipmentError) {
        problems.push(e.message);
        continue;
      }
      throw e;
    }
    deleted += 1;
    for (const it of inv.items) if (it.variant) invalidateProduct({ id: it.variant.product.id, slug: it.variant.product.slug });
  }
  refresh();
  if (problems.length === 0) return OK;
  return fail(`${deleted ? `Deleted ${deleted}. ` : ""}Couldn't delete ${problems.length}: ${problems.join(" ")} Correct the stock first.`);
}

// ================================================================================ owners

export async function saveStockOwner(_prev: Result | null, formData: FormData): Promise<Result> {
  if (!(await requireFinance())) return fail("Not authorized.");
  const parsed = z
    .object({ id: z.string().min(1), name: text(100).min(1, "Owner name is required."), contact: optional(120), notes: optional(300) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(firstError(parsed.error));
  const { id, ...data } = parsed.data;
  const found = await db.stockOwner.updateMany({ where: { id }, data });
  if (found.count === 0) return fail("That owner no longer exists.");
  refresh();
  return OK;
}

export async function deleteStockOwner(id: string): Promise<Result> {
  if (!(await requireFinance())) return fail("Not authorized.");
  const [inv, exp] = await Promise.all([db.investment.count({ where: { ownerId: id } }), db.expense.count({ where: { ownerId: id } })]);
  if (inv + exp > 0) return fail("This owner has investments or expenses on record, so they can't be removed. Edit or delete those first.");
  await db.stockOwner.deleteMany({ where: { id } });
  refresh();
  return OK;
}

// ================================================================================ manual sales

const itemSchema = z.object({
  description: text(200).min(1, "Every item needs a description."),
  variantId: z.string().nullable().optional(),
  qty: z.coerce.number().int("Quantity must be a whole number.").min(1, "Quantity must be at least 1.").max(100000),
  unitPrice: money("Price"),
  unitCost: z.preprocess((v) => (v === "" || v == null ? null : v), money("Cost").nullable()),
  deduct: z.boolean().optional(),
});

const saleSchema = z.object({
  id: z.string().optional(),
  date: day,
  customerName: text(120).min(1, "Enter the customer's name."),
  customerPhone: optional(40),
  customerEmail: optional(160),
  customerAddress: optional(300),
  method: methodSchema,
  paid: z.boolean(),
  discount: money("Discount"),
  deliveryCharge: money("Delivery charge"),
  notes: optional(500),
  items: z.array(itemSchema).min(1, "Add at least one item."),
});

class SaleError extends Error {}

function newSaleNumber(): string {
  return `MS-${todayDhaka().replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;
}

export async function saveManualSale(_prev: Result | null, formData: FormData): Promise<Result> {
  const admin = await requireFinance();
  if (!admin) return fail("Not authorized.");

  let items: unknown;
  try {
    items = JSON.parse(String(formData.get("items") ?? "[]"));
  } catch {
    return fail("The items couldn't be read — reload the page and try again.");
  }
  const parsed = saleSchema.safeParse({
    id: formData.get("id") || undefined,
    date: formData.get("date"),
    customerName: formData.get("customerName") ?? "",
    customerPhone: formData.get("customerPhone") ?? "",
    customerEmail: formData.get("customerEmail") ?? "",
    customerAddress: formData.get("customerAddress") ?? "",
    method: formData.get("method"),
    paid: formData.get("paid") === "on",
    discount: formData.get("discount") || 0,
    deliveryCharge: formData.get("deliveryCharge") || 0,
    notes: formData.get("notes") ?? "",
    items,
  });
  if (!parsed.success) return fail(firstError(parsed.error));
  const d = parsed.data;
  if (d.customerEmail && !/^\S+@\S+\.\S+$/.test(d.customerEmail)) return fail("That email address doesn't look right.");

  const subtotal = d.items.reduce((s, i) => s + i.qty * i.unitPrice, 0);
  if (d.discount > subtotal) return fail("The discount can't be more than the items come to.");
  const total = Math.round((subtotal - d.discount + d.deliveryCharge) * 100) / 100;
  const touchedVariants = new Set<string>();

  try {
    await db.$transaction(async (tx) => {
      let saleId = d.id;
      let number: string | undefined;

      if (saleId) {
        const existing = await tx.manualSale.findUnique({ where: { id: saleId }, include: { items: true } });
        if (!existing) throw new SaleError("That sale no longer exists.");
        // Put back whatever the old version took off the shelf; the new version takes its own.
        for (const it of existing.items) {
          if (it.stockDeducted && it.variantId) {
            await tx.variant.update({ where: { id: it.variantId }, data: { stockQty: { increment: it.qty } } });
            touchedVariants.add(it.variantId);
          }
        }
        await tx.manualSaleItem.deleteMany({ where: { saleId } });
      } else {
        for (let attempt = 0; attempt < 5 && !number; attempt++) {
          const candidate = newSaleNumber();
          if (!(await tx.manualSale.findUnique({ where: { number: candidate }, select: { id: true } }))) number = candidate;
        }
        if (!number) throw new SaleError("Couldn't make a sale number — try again.");
      }

      const header = {
        date: entryDate(d.date),
        customerName: d.customerName,
        customerPhone: d.customerPhone,
        customerEmail: d.customerEmail,
        customerAddress: d.customerAddress,
        method: d.method,
        paid: d.paid,
        discount: d.discount,
        deliveryCharge: d.deliveryCharge,
        total,
        notes: d.notes,
      };
      if (saleId) await tx.manualSale.update({ where: { id: saleId }, data: header });
      else saleId = (await tx.manualSale.create({ data: { ...header, number: number!, createdByEmail: admin.email } })).id;

      for (const it of d.items) {
        let variantId: string | null = null;
        let deducted = false;
        const unitCost = it.unitCost;
        if (it.variantId) {
          const v = await tx.variant.findUnique({ where: { id: it.variantId }, select: { id: true, stockQty: true } });
          if (v) {
            variantId = v.id;
            if (it.deduct) {
              const taken = await tx.variant.updateMany({ where: { id: v.id, stockQty: { gte: it.qty } }, data: { stockQty: { decrement: it.qty } } });
              if (taken.count === 0) throw new SaleError(`Not enough stock for "${it.description}" — ${v.stockQty} in stock, ${it.qty} wanted. Untick "take from stock" or fix the stock first.`);
              deducted = true;
              touchedVariants.add(v.id);
            }
          }
        }
        await tx.manualSaleItem.create({
          data: { saleId: saleId!, description: it.description, variantId, qty: it.qty, unitPrice: it.unitPrice, unitCost, stockDeducted: deducted },
        });
      }
    });
  } catch (e) {
    if (e instanceof SaleError) return fail(e.message);
    throw e;
  }

  await invalidateVariants(touchedVariants);
  refresh();
  return OK;
}

/** Removes one manual sale inside a transaction, putting back any stock it took. */
async function removeManualSale(tx: Prisma.TransactionClient, id: string, touched: Set<string>) {
  const sale = await tx.manualSale.findUnique({ where: { id }, include: { items: true } });
  if (!sale) return;
  for (const it of sale.items) {
    if (it.stockDeducted && it.variantId) {
      await tx.variant.update({ where: { id: it.variantId }, data: { stockQty: { increment: it.qty } } });
      touched.add(it.variantId);
    }
  }
  await tx.manualSale.delete({ where: { id } });
}

export async function deleteManualSale(id: string): Promise<Result> {
  return deleteManualSales([id]);
}

export async function deleteManualSales(ids: string[]): Promise<Result> {
  if (!(await requireFinance())) return fail("Not authorized.");
  const touched = new Set<string>();
  await db.$transaction(async (tx) => {
    for (const id of ids) await removeManualSale(tx, id, touched);
  });
  await invalidateVariants(touched);
  refresh();
  return OK;
}

async function invalidateVariants(variantIds: Set<string>) {
  if (variantIds.size === 0) return;
  const products = await db.product.findMany({ where: { variants: { some: { id: { in: [...variantIds] } } } }, select: { id: true, slug: true } });
  for (const p of products) invalidateProduct({ id: p.id, slug: p.slug });
}

// ================================================================================ online orders in the reports

/** Marks an order's cash as collected on the given day (defaults to today), from the Finance screens. */
export async function markCashCollected(orderId: string, collectedOn: string): Promise<Result> {
  if (!(await requireFinance())) return fail("Not authorized.");
  const when = /^\d{4}-\d{2}-\d{2}$/.test(collectedOn) ? entryDate(collectedOn) : new Date();
  const found = await db.order.updateMany({ where: { id: orderId }, data: { balanceCollected: true, cashCollectedAt: when } });
  if (found.count === 0) return fail("That order no longer exists.");
  revalidatePath(`/admin/orders/${orderId}`);
  refresh();
  return OK;
}

export async function undoCashCollected(orderId: string): Promise<Result> {
  if (!(await requireFinance())) return fail("Not authorized.");
  await db.order.updateMany({ where: { id: orderId }, data: { balanceCollected: false, cashCollectedAt: null } });
  revalidatePath(`/admin/orders/${orderId}`);
  refresh();
  return OK;
}

/**
 * Takes online orders out of (or puts them back into) every finance report. The order itself —
 * its page, the customer's view, the stock — is untouched; only the money figures change.
 */
export async function setOrdersExcludedFromFinance(ids: string[], excluded: boolean): Promise<Result> {
  if (!(await requireFinance())) return fail("Not authorized.");
  await db.order.updateMany({ where: { id: { in: ids } }, data: { excludeFromFinance: excluded } });
  refresh();
  return OK;
}
