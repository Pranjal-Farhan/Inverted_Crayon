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

export async function recordStockPurchase(
  _prev: { ok: boolean; error: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error: string }> {
  if (!(await getAdminForArea("finance"))) return { ok: false, error: "Not authorized." };

  const ownerId = String(formData.get("ownerId") ?? "");
  const variantId = String(formData.get("variantId") ?? "") || null;
  const quantity = Number(formData.get("quantity"));
  const supplierName = String(formData.get("supplierName") ?? "").trim() || null;
  const purchaseDateRaw = String(formData.get("purchaseDate") ?? "");
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!ownerId) return { ok: false, error: "Select an owner." };
  if (!variantId) return { ok: false, error: "Select a product variant." };
  if (!Number.isInteger(quantity) || quantity <= 0) return { ok: false, error: "Quantity must be a whole number above zero." };

  const owner = await db.stockOwner.findUnique({ where: { id: ownerId } });
  if (!owner) return { ok: false, error: "That owner no longer exists." };

  const variant = await db.variant.findUnique({ where: { id: variantId }, include: { product: { omit: { purchaseCost: false } } } });
  if (!variant) return { ok: false, error: "That variant no longer exists." };
  // The price comes from the product's purchase cost — one place to keep it (Products → edit →
  // Purchase cost) — and is frozen onto this record so a later change doesn't rewrite what was paid.
  if (variant.product.purchaseCost == null) {
    return { ok: false, error: `Set the purchase cost for “${variant.product.title}” on its product page first, then record the purchase.` };
  }
  const unitCost = toNumber(variant.product.purchaseCost);

  const purchaseDate = /^\d{4}-\d{2}-\d{2}$/.test(purchaseDateRaw) ? entryDate(purchaseDateRaw) : new Date();
  const totalCost = quantity * unitCost;

  await db.$transaction([
    db.stockPurchase.create({
      data: {
        ownerId,
        productId: variant.productId,
        variantId: variant.id,
        productTitleSnapshot: variant.product.title,
        variantLabelSnapshot: `${variant.size} / ${variant.color}`,
        quantity,
        unitCost,
        totalCost,
        supplierName,
        purchaseDate,
        notes,
      },
    }),
    db.variant.update({ where: { id: variant.id }, data: { stockQty: { increment: quantity } } }),
  ]);

  revalidatePath("/admin/finance");
  // A stock purchase increments stockQty, which can flip a sold-out/preorder badge.
  invalidateProduct({ id: variant.productId, slug: variant.product.slug });
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

const investmentSchema = z.object({
  id: z.string().optional(),
  date: day,
  amount: money("Amount").refine((n) => n > 0, "Amount must be more than zero."),
  ownerId: z.string().min(1, "Choose who invested."),
  description: optional(140),
  method: methodSchema,
  notes: optional(500),
});

export async function saveInvestment(_prev: Result | null, formData: FormData): Promise<Result> {
  const admin = await requireFinance();
  if (!admin) return fail("Not authorized.");
  const parsed = investmentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(firstError(parsed.error));
  const { id, date, ...rest } = parsed.data;
  if (!(await db.stockOwner.findUnique({ where: { id: rest.ownerId }, select: { id: true } }))) return fail("That owner no longer exists.");
  const data = { ...rest, date: entryDate(date) };
  if (id) {
    const found = await db.investment.updateMany({ where: { id }, data });
    if (found.count === 0) return fail("That investment no longer exists.");
  } else {
    await db.investment.create({ data: { ...data, createdByEmail: admin.email } });
  }
  refresh();
  return OK;
}

export async function deleteInvestment(id: string): Promise<Result> {
  return deleteInvestments([id]);
}

export async function deleteInvestments(ids: string[]): Promise<Result> {
  if (!(await requireFinance())) return fail("Not authorized.");
  await db.investment.deleteMany({ where: { id: { in: ids } } });
  refresh();
  return OK;
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
  const [inv, buys, exp] = await Promise.all([
    db.investment.count({ where: { ownerId: id } }),
    db.stockPurchase.count({ where: { ownerId: id } }),
    db.expense.count({ where: { ownerId: id } }),
  ]);
  if (inv + buys + exp > 0) return fail("This owner has investments, stock purchases or expenses on record, so they can't be removed. Edit or delete those first.");
  await db.stockOwner.deleteMany({ where: { id } });
  refresh();
  return OK;
}

// ================================================================================ stock purchases

export async function updateStockPurchase(_prev: Result | null, formData: FormData): Promise<Result> {
  if (!(await requireFinance())) return fail("Not authorized.");
  const parsed = z
    .object({ id: z.string().min(1), ownerId: z.string().min(1, "Choose an owner."), date: day, supplierName: optional(120), notes: optional(500) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail(firstError(parsed.error));
  const { id, date, ...rest } = parsed.data;
  if (!(await db.stockOwner.findUnique({ where: { id: rest.ownerId }, select: { id: true } }))) return fail("That owner no longer exists.");
  const found = await db.stockPurchase.updateMany({ where: { id }, data: { ...rest, purchaseDate: entryDate(date) } });
  if (found.count === 0) return fail("That purchase no longer exists.");
  refresh();
  return OK;
}

/** Removes a purchase and takes its units back off the shelf — refused if some have already been sold. */
export async function deleteStockPurchase(id: string): Promise<Result> {
  return deleteStockPurchases([id]);
}

/** Each purchase is handled on its own: the ones that can go, go; the ones with units already sold are reported. */
export async function deleteStockPurchases(ids: string[]): Promise<Result> {
  if (!(await requireFinance())) return fail("Not authorized.");
  const problems: string[] = [];
  let deleted = 0;
  for (const id of ids) {
    const p = await db.stockPurchase.findUnique({ where: { id }, include: { variant: { include: { product: { select: { id: true, slug: true } } } } } });
    if (!p) continue;
    if (p.variantId && p.variant) {
      const taken = await db.variant.updateMany({ where: { id: p.variantId, stockQty: { gte: p.quantity } }, data: { stockQty: { decrement: p.quantity } } });
      if (taken.count === 0) {
        problems.push(`${p.productTitleSnapshot} (${p.variantLabelSnapshot}): this purchase added ${p.quantity} units, but fewer than that are in stock now — some were sold.`);
        continue;
      }
      invalidateProduct({ id: p.variant.product.id, slug: p.variant.product.slug });
    }
    await db.stockPurchase.delete({ where: { id } });
    deleted += 1;
  }
  refresh();
  if (problems.length === 0) return OK;
  return fail(`${deleted ? `Deleted ${deleted}. ` : ""}Couldn't delete ${problems.length}: ${problems.join(" ")} Correct the stock first.`);
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
