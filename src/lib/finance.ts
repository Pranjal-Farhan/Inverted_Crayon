import "server-only";
import { db } from "@/lib/db";
import type { $Enums } from "@/generated/prisma/client";
import { toNumber } from "@/lib/money";
import { ADMIN_STATUS_LABEL } from "@/lib/order-status";
import { dhakaDay, dhakaMonth, inRange, monthsBetween, todayDhaka, type DateRange } from "@/lib/finance-dates";

/**
 * The money side of the shop, worked out from what's already in the database. Four numbers, and
 * the rules behind them, in one place:
 *
 *  TOTAL SALES   Revenue. Every order — from the website, or recorded by hand under Finance → Sales —
 *                is a sale, with the status it has under Orders (Not Cleared Yet, Sent For Delivery,
 *                Delivered, Cancelled, Refunded, Returned). An order COUNTS once it is Delivered, or
 *                has been paid in advance, and has not since been cancelled, refunded or returned;
 *                it counts on the day it was delivered (or placed, if paid up front), in Dhaka time.
 *                What it adds is the order total: the products after discount, plus the delivery charged.
 *
 *  BUYING COST   What the items that were sold cost to buy: for each unit on a counted sale, the
 *                purchase cost typed on the product (admin → Products → edit → Purchase cost; every size
 *                and colour costs the same). Units whose product has no purchase cost are counted and
 *                flagged instead of guessed, because they overstate profit.
 *
 *  EXPENSES      Every expense entered under Finance → Expenses, in the month it was dated. The goods
 *                themselves are NOT entered as an expense — they are the Buying Cost, once sold — so
 *                this is everything else it costs to run the shop and to get stock here (freight,
 *                customs, packaging, rent, ads…), filed under categories the admin created.
 *
 *  PROFIT        Total Sales − Buying Cost − Expenses.
 *
 *  REMOVED       An online order can be left out of every report (a test order, say) without touching
 *                the order itself.
 */

export type SaleStatusKey = "NOT_CLEARED" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "REFUNDED" | "RETURNED";

/** The designed order statuses, in pipeline order, with the stored OrderStatus values each one covers. */
export const SALE_STATUSES: { key: SaleStatusKey; label: string; stored: $Enums.OrderStatus[] }[] = [
  { key: "NOT_CLEARED", label: ADMIN_STATUS_LABEL.PENDING, stored: ["PENDING", "PAID", "PROCESSING"] },
  { key: "SHIPPED", label: ADMIN_STATUS_LABEL.SHIPPED, stored: ["SHIPPED"] },
  { key: "DELIVERED", label: ADMIN_STATUS_LABEL.DELIVERED, stored: ["DELIVERED"] },
  { key: "CANCELLED", label: ADMIN_STATUS_LABEL.CANCELLED, stored: ["CANCELLED"] },
  { key: "REFUNDED", label: ADMIN_STATUS_LABEL.REFUNDED, stored: ["REFUNDED"] },
  { key: "RETURNED", label: ADMIN_STATUS_LABEL.RETURNED, stored: ["RETURNED"] },
];

const statusKeyOf = (s: $Enums.OrderStatus): SaleStatusKey => SALE_STATUSES.find((x) => x.stored.includes(s))!.key;

export const METHOD_LABEL: Record<string, string> = {
  CASH: "Cash",
  BKASH: "bKash",
  BANK: "Bank transfer",
  CARD: "Card",
  OTHER: "Other",
  COD: "Cash on delivery",
  SSLCOMMERZ: "Card / mobile banking",
};

const LOST_STATUSES: $Enums.OrderStatus[] = ["CANCELLED", "REFUNDED", "RETURNED"];

export type SaleLine = { title: string; variant: string; sku: string; qty: number; unitPrice: number };

export type SaleRow = {
  key: string;
  source: "ONLINE" | "RECORDED";
  id: string;
  /** The order number, e.g. IC-… or MS-… */
  ref: string;
  /** Where clicking the row goes: the order, with full details, under Orders. */
  href: string;
  /** The day the sale counts (delivery day for a counted order, else the day it was placed). */
  date: Date;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  lines: SaleLine[];
  itemCount: number;
  status: SaleStatusKey;
  statusLabel: string;
  /** True when it adds to Total Sales (see the rules above). */
  counted: boolean;
  paymentLabel: string;
  /** Order total: products after discount + delivery. */
  revenue: number;
  itemsRevenue: number;
  delivery: number;
  /** Buying cost of the units on this order. */
  cogs: number;
  unknownCostUnits: number;
  /** Revenue − buying cost; only for a counted sale. */
  profit: number;
};

export type ExpenseEntry = {
  id: string;
  date: Date;
  amount: number;
  categoryId: string;
  category: string;
  title: string;
  paidTo: string;
  method: string;
  ownerId: string;
  ownerName: string;
  notes: string;
  createdBy: string;
};

export type FinanceData = Awaited<ReturnType<typeof loadFinance>>;

export async function loadFinance() {
  const [orders, expensesRaw, categories, owners, products] = await Promise.all([
    db.order.findMany({
      select: {
        id: true,
        number: true,
        source: true,
        status: true,
        paymentStatus: true,
        paymentMethod: true,
        recordedMethod: true,
        subtotal: true,
        shippingCost: true,
        discountAmount: true,
        total: true,
        createdAt: true,
        updatedAt: true,
        deliveredAt: true,
        excludeFromFinance: true,
        email: true,
        phone: true,
        shippingFullName: true,
        items: {
          select: {
            productId: true,
            variantId: true,
            productTitleSnapshot: true,
            variantLabelSnapshot: true,
            qty: true,
            unitPrice: true,
            unitCost: true,
            variant: { select: { sku: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.expense.findMany({ include: { owner: true, category: true }, orderBy: [{ date: "desc" }, { createdAt: "desc" }] }),
    db.expenseCategory.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { expenses: true } } } }),
    db.stockOwner.findMany({ orderBy: { createdAt: "asc" } }),
    // purchaseCost is asked for explicitly — it is left out of every query by default (lib/db.ts).
    db.product.findMany({ select: { id: true, purchaseCost: true, variants: { select: { id: true } } } }),
  ]);

  // What one unit costs the business: the purchase cost typed on the product. Every size and colour
  // of a product costs the same; a product with none entered yet is "unknown" and gets flagged.
  const productCost = new Map<string, number>();
  const variantProduct = new Map<string, string>();
  for (const p of products) {
    if (p.purchaseCost != null) productCost.set(p.id, toNumber(p.purchaseCost));
    for (const v of p.variants) variantProduct.set(v.id, p.id);
  }
  const unitCostOf = (item: { productId?: string | null; variantId?: string | null }): number | null => {
    const productId = item.productId ?? (item.variantId ? variantProduct.get(item.variantId) : undefined);
    return productId ? (productCost.get(productId) ?? null) : null;
  };

  const sales: SaleRow[] = [];
  /** Online orders taken out of the reports — kept so they can be listed and restored, never counted. */
  const removed: SaleRow[] = [];

  for (const o of orders) {
    const lost = LOST_STATUSES.includes(o.status);
    const counted = !lost && (o.status === "DELIVERED" || o.paymentStatus === "PAID");
    const date = counted ? (o.deliveredAt ?? (o.status === "DELIVERED" ? o.updatedAt : o.createdAt)) : o.createdAt;
    let cogs = 0;
    let unknown = 0;
    for (const i of o.items) {
      // A line with a cost typed on it (old recorded sales only) uses that; everything else the product's purchase cost.
      const c = i.unitCost != null ? toNumber(i.unitCost) : unitCostOf(i);
      if (c === null) unknown += i.qty;
      else cogs += c * i.qty;
    }
    const revenue = toNumber(o.total);
    const delivery = toNumber(o.shippingCost);
    const recorded = o.source === "RECORDED";
    const row: SaleRow = {
      key: `order:${o.id}`,
      source: o.source,
      id: o.id,
      ref: o.number,
      href: `/admin/orders/${o.id}`,
      date,
      customerName: o.shippingFullName,
      customerPhone: o.phone || null,
      customerEmail: o.email || null,
      lines: o.items.map((i) => ({ title: i.productTitleSnapshot, variant: i.variantLabelSnapshot, sku: i.variant?.sku ?? "", qty: i.qty, unitPrice: toNumber(i.unitPrice) })),
      itemCount: o.items.reduce((s, i) => s + i.qty, 0),
      status: statusKeyOf(o.status),
      statusLabel: ADMIN_STATUS_LABEL[o.status],
      counted,
      paymentLabel: METHOD_LABEL[(recorded ? o.recordedMethod : o.paymentMethod) ?? o.paymentMethod] ?? o.paymentMethod,
      revenue,
      itemsRevenue: revenue - delivery,
      delivery,
      cogs,
      unknownCostUnits: unknown,
      profit: counted ? revenue - cogs : 0,
    };
    (o.excludeFromFinance ? removed : sales).push(row);
  }
  sales.sort((a, b) => b.date.getTime() - a.date.getTime());
  removed.sort((a, b) => b.date.getTime() - a.date.getTime());

  const expenses: ExpenseEntry[] = expensesRaw.map((e) => ({
    id: e.id,
    date: e.date,
    amount: toNumber(e.amount),
    categoryId: e.categoryId,
    category: e.category.name,
    title: e.title,
    paidTo: e.paidTo ?? "",
    method: METHOD_LABEL[e.method] ?? e.method,
    ownerId: e.ownerId ?? "",
    ownerName: e.owner?.name ?? "",
    notes: e.notes ?? "",
    createdBy: e.createdByEmail ?? "",
  }));

  return { sales, removed, expenses, categories, owners, unitCostOf };
}

// ------------------------------------------------------------------------------ the four numbers

export type Summary = {
  /** Total Sales. */
  revenue: number;
  itemsRevenue: number;
  delivery: number;
  /** Buying Cost. */
  buyingCost: number;
  /** Expenses. */
  expenses: number;
  /** Profit = revenue − buying cost − expenses. */
  profit: number;
  /** Profit as a share of Total Sales. */
  margin: number;
  countedSales: number;
  onlineSales: number;
  recordedSales: number;
  expenseCount: number;
  unknownCostUnits: number;
  expensesByCategory: { category: string; amount: number; count: number }[];
  expensesByOwner: { owner: string; amount: number; count: number }[];
};

export function summarize(data: FinanceData, range: DateRange): Summary {
  const done = data.sales.filter((s) => s.counted && inRange(s.date, range));
  const revenue = done.reduce((s, r) => s + r.revenue, 0);
  const buyingCost = done.reduce((s, r) => s + r.cogs, 0);

  const cats = new Map<string, { amount: number; count: number }>();
  const owners = new Map<string, { amount: number; count: number }>();
  let expenses = 0;
  let expenseCount = 0;
  for (const e of data.expenses) {
    if (!inRange(e.date, range)) continue;
    expenses += e.amount;
    expenseCount += 1;
    const c = cats.get(e.category) ?? { amount: 0, count: 0 };
    c.amount += e.amount;
    c.count += 1;
    cats.set(e.category, c);
    const ownerName = e.ownerName || "Not recorded";
    const o = owners.get(ownerName) ?? { amount: 0, count: 0 };
    o.amount += e.amount;
    o.count += 1;
    owners.set(ownerName, o);
  }
  const profit = revenue - buyingCost - expenses;
  return {
    revenue,
    itemsRevenue: done.reduce((s, r) => s + r.itemsRevenue, 0),
    delivery: done.reduce((s, r) => s + r.delivery, 0),
    buyingCost,
    expenses,
    profit,
    margin: revenue > 0 ? (profit / revenue) * 100 : 0,
    countedSales: done.length,
    onlineSales: done.filter((s) => s.source === "ONLINE").length,
    recordedSales: done.filter((s) => s.source === "RECORDED").length,
    expenseCount,
    unknownCostUnits: done.reduce((s, r) => s + r.unknownCostUnits, 0),
    expensesByCategory: [...cats.entries()].map(([category, v]) => ({ category, ...v })).sort((a, b) => b.amount - a.amount),
    expensesByOwner: [...owners.entries()].map(([owner, v]) => ({ owner, ...v })).sort((a, b) => b.amount - a.amount),
  };
}

export type MonthRow = { month: string; sales: number; revenue: number; buyingCost: number; expenses: number; profit: number };

/** One row per month across the range (all time: from the first entry to now), oldest first. */
export function monthly(data: FinanceData, range: DateRange): MonthRow[] {
  const dates: Date[] = [...data.sales.filter((s) => s.counted).map((s) => s.date), ...data.expenses.map((e) => e.date)];
  const today = todayDhaka();
  const first = dates.length ? dhakaDay(new Date(Math.min(...dates.map((d) => d.getTime())))) : today;
  const from = range.from ?? first;
  const to = range.to ?? today;
  const months = monthsBetween(from, to > today && !range.to ? today : to);
  const rows = new Map<string, MonthRow>(months.map((m) => [m, { month: m, sales: 0, revenue: 0, buyingCost: 0, expenses: 0, profit: 0 }]));
  for (const s of data.sales) {
    if (!s.counted) continue;
    const r = rows.get(dhakaMonth(s.date));
    if (!r) continue;
    r.sales += 1;
    r.revenue += s.revenue;
    r.buyingCost += s.cogs;
  }
  for (const e of data.expenses) {
    const r = rows.get(dhakaMonth(e.date));
    if (r) r.expenses += e.amount;
  }
  for (const r of rows.values()) r.profit = r.revenue - r.buyingCost - r.expenses;
  return [...rows.values()];
}

// ------------------------------------------------------------------------------ CSV

/** A spreadsheet will run a cell that starts with = + - or @ as a formula, and these cells hold typed-in text. */
function csvCell(v: string | number): string {
  let s = typeof v === "number" ? String(Math.round(v * 100) / 100) : v;
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: (string | number)[][]): string {
  return "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
