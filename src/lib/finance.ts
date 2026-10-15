import "server-only";
import { db } from "@/lib/db";
import { toNumber } from "@/lib/money";
import { ADMIN_STATUS_LABEL } from "@/lib/order-status";
import { dhakaDay, dhakaMonth, inRange, monthsBetween, todayDhaka, type DateRange } from "@/lib/finance-dates";

/**
 * The money side of the shop, worked out from what's already in the database. The rules, in one place:
 *
 *  SALES — every online order and every manually recorded sale is a row, with one of four states:
 *    COMPLETED    counts as revenue. An online order is complete once it's DELIVERED (for cash on
 *                 delivery that is when the cash comes in) or has been paid online and not since
 *                 cancelled/refunded/returned. A manual sale is complete when it's marked paid.
 *    IN_PROGRESS  an online order that isn't delivered yet — shown as "expected", not counted.
 *    UNPAID       a manual sale not yet paid — shown, not counted.
 *    LOST         cancelled, refunded or returned — shown, not counted.
 *  A completed sale counts on the day it was delivered (online) or dated (manual), in Dhaka time.
 *
 *  COST OF GOODS — each unit sold costs what it cost to buy: the variant's weighted-average unit cost
 *  over every stock purchase on record (the same method as before). Units with no known cost are
 *  counted and flagged rather than guessed.
 *
 *  NET PROFIT = revenue − cost of goods − expenses. Investments (owners putting money in) and stock
 *  purchases (inventory) are NOT expenses: investments aren't income, and stock only becomes a cost
 *  when it's sold. Both do move cash, so the statement shows them.
 *
 *  CASH — money in (completed sales + investments) minus money out (expenses + stock purchases).
 */

export type SaleStatus = "COMPLETED" | "IN_PROGRESS" | "UNPAID" | "LOST";

export type SaleRow = {
  key: string;
  source: "ORDER" | "MANUAL";
  id: string;
  ref: string;
  href: string;
  /** The day the sale counts (delivery day for a completed online order, else the day it was placed). */
  date: Date;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  itemsSummary: string;
  itemCount: number;
  status: SaleStatus;
  statusLabel: string;
  paymentLabel: string;
  revenue: number;
  /** Product sales net of discount, and delivery charged — revenue is their sum. */
  itemsRevenue: number;
  delivery: number;
  cogs: number;
  unknownCostUnits: number;
  profit: number;
};

export type TxnKind = "SALE" | "EXPENSE" | "INVESTMENT" | "STOCK_PURCHASE";

export type Txn = {
  key: string;
  kind: TxnKind;
  /** Which entry to open or edit. */
  id: string;
  date: Date;
  title: string;
  party: string;
  category: string;
  method: string;
  inAmount: number;
  outAmount: number;
  href: string;
};

export const KIND_LABEL: Record<TxnKind, string> = {
  SALE: "Sale",
  EXPENSE: "Expense",
  INVESTMENT: "Investment",
  STOCK_PURCHASE: "Stock purchase",
};

export const METHOD_LABEL: Record<string, string> = {
  CASH: "Cash",
  BKASH: "bKash",
  NAGAD: "Nagad",
  BANK: "Bank transfer",
  CARD: "Card",
  OTHER: "Other",
  COD: "Cash on delivery",
  SSLCOMMERZ: "Card / mobile banking",
};

export const EXPENSE_CATEGORIES = [
  "Rent",
  "Salaries & wages",
  "Marketing & ads",
  "Packaging",
  "Delivery & courier",
  "Utilities",
  "Software & subscriptions",
  "Photography & content",
  "Equipment",
  "Taxes & fees",
  "Travel",
  "Repairs & maintenance",
  "Other",
];

const LOST_STATUSES = ["CANCELLED", "REFUNDED", "RETURNED"];

export type FinanceData = Awaited<ReturnType<typeof loadFinance>>;

export async function loadFinance() {
  const [orders, manualSales, expenses, investments, purchases, owners] = await Promise.all([
    db.order.findMany({
      select: {
        id: true,
        number: true,
        status: true,
        paymentStatus: true,
        paymentMethod: true,
        subtotal: true,
        shippingCost: true,
        discountAmount: true,
        total: true,
        createdAt: true,
        updatedAt: true,
        deliveredAt: true,
        email: true,
        phone: true,
        shippingFullName: true,
        items: { select: { variantId: true, productTitleSnapshot: true, variantLabelSnapshot: true, qty: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.manualSale.findMany({ include: { items: true }, orderBy: { date: "desc" } }),
    db.expense.findMany({ orderBy: { date: "desc" } }),
    db.investment.findMany({ include: { owner: true }, orderBy: { date: "desc" } }),
    db.stockPurchase.findMany({ include: { owner: true }, orderBy: { purchaseDate: "desc" } }),
    db.stockOwner.findMany({ orderBy: { createdAt: "asc" } }),
  ]);

  // Weighted-average unit cost per variant, from every purchase on record for it.
  const basis = new Map<string, { qty: number; cost: number }>();
  for (const p of purchases) {
    if (!p.variantId) continue;
    const e = basis.get(p.variantId) ?? { qty: 0, cost: 0 };
    e.qty += p.quantity;
    e.cost += toNumber(p.totalCost);
    basis.set(p.variantId, e);
  }
  const avgCost = (variantId: string | null | undefined): number | null => {
    if (!variantId) return null;
    const e = basis.get(variantId);
    return e && e.qty > 0 ? e.cost / e.qty : null;
  };

  const sales: SaleRow[] = [];

  for (const o of orders) {
    const lost = LOST_STATUSES.includes(o.status);
    const completed = !lost && (o.status === "DELIVERED" || o.paymentStatus === "PAID");
    const status: SaleStatus = lost ? "LOST" : completed ? "COMPLETED" : "IN_PROGRESS";
    const date = completed ? (o.deliveredAt ?? (o.status === "DELIVERED" ? o.updatedAt : o.createdAt)) : o.createdAt;
    let cogs = 0;
    let unknown = 0;
    for (const i of o.items) {
      const c = avgCost(i.variantId);
      if (c === null) unknown += i.qty;
      else cogs += c * i.qty;
    }
    const revenue = toNumber(o.total);
    const delivery = toNumber(o.shippingCost);
    sales.push({
      key: `order:${o.id}`,
      source: "ORDER",
      id: o.id,
      ref: o.number,
      href: `/admin/orders/${o.id}`,
      date,
      customerName: o.shippingFullName,
      customerPhone: o.phone,
      customerEmail: o.email,
      itemsSummary: o.items.map((i) => `${i.qty}× ${i.productTitleSnapshot} (${i.variantLabelSnapshot})`).join(", "),
      itemCount: o.items.reduce((s, i) => s + i.qty, 0),
      status,
      statusLabel: ADMIN_STATUS_LABEL[o.status],
      paymentLabel: METHOD_LABEL[o.paymentMethod] ?? o.paymentMethod,
      revenue,
      itemsRevenue: revenue - delivery,
      delivery,
      cogs,
      unknownCostUnits: unknown,
      profit: status === "COMPLETED" ? revenue - cogs : 0,
    });
  }

  for (const m of manualSales) {
    let cogs = 0;
    let unknown = 0;
    for (const i of m.items) {
      const c = i.unitCost != null ? toNumber(i.unitCost) : avgCost(i.variantId);
      if (c === null) unknown += i.qty;
      else cogs += c * i.qty;
    }
    const revenue = toNumber(m.total);
    const delivery = toNumber(m.deliveryCharge);
    const status: SaleStatus = m.paid ? "COMPLETED" : "UNPAID";
    sales.push({
      key: `manual:${m.id}`,
      source: "MANUAL",
      id: m.id,
      ref: m.number,
      href: `/admin/finance/sales#${m.id}`,
      date: m.date,
      customerName: m.customerName,
      customerPhone: m.customerPhone,
      customerEmail: m.customerEmail,
      itemsSummary: m.items.map((i) => `${i.qty}× ${i.description}`).join(", "),
      itemCount: m.items.reduce((s, i) => s + i.qty, 0),
      status,
      statusLabel: m.paid ? "Paid" : "Awaiting payment",
      paymentLabel: METHOD_LABEL[m.method] ?? m.method,
      revenue,
      itemsRevenue: revenue - delivery,
      delivery,
      cogs,
      unknownCostUnits: unknown,
      profit: status === "COMPLETED" ? revenue - cogs : 0,
    });
  }
  sales.sort((a, b) => b.date.getTime() - a.date.getTime());

  return { orders, manualSales, expenses, investments, purchases, owners, sales, avgCost };
}

// ------------------------------------------------------------------------------ the ledger

/** Every movement of money, oldest first: completed sales and investments in; expenses and stock purchases out. */
export function allTransactions(data: FinanceData): Txn[] {
  const t: Txn[] = [];
  for (const s of data.sales) {
    if (s.status !== "COMPLETED") continue;
    t.push({
      key: s.key,
      kind: "SALE",
      id: s.id,
      date: s.date,
      title: `${s.source === "ORDER" ? "Order" : "Manual sale"} ${s.ref}`,
      party: s.customerName,
      category: s.source === "ORDER" ? "Online order" : "Manual sale",
      method: s.paymentLabel,
      inAmount: s.revenue,
      outAmount: 0,
      href: s.href,
    });
  }
  for (const e of data.expenses) {
    t.push({
      key: `expense:${e.id}`,
      kind: "EXPENSE",
      id: e.id,
      date: e.date,
      title: e.title,
      party: e.paidTo ?? "",
      category: e.category,
      method: METHOD_LABEL[e.method] ?? e.method,
      inAmount: 0,
      outAmount: toNumber(e.amount),
      href: "/admin/finance/expenses",
    });
  }
  for (const i of data.investments) {
    t.push({
      key: `investment:${i.id}`,
      kind: "INVESTMENT",
      id: i.id,
      date: i.date,
      title: i.description?.trim() || "Investment",
      party: i.owner.name,
      category: "Investment",
      method: METHOD_LABEL[i.method] ?? i.method,
      inAmount: toNumber(i.amount),
      outAmount: 0,
      href: "/admin/finance/investments",
    });
  }
  for (const p of data.purchases) {
    t.push({
      key: `purchase:${p.id}`,
      kind: "STOCK_PURCHASE",
      id: p.id,
      date: p.purchaseDate,
      title: `${p.quantity}× ${p.productTitleSnapshot} (${p.variantLabelSnapshot})`,
      party: p.supplierName ?? p.owner.name,
      category: "Stock purchase",
      method: "",
      inAmount: 0,
      outAmount: toNumber(p.totalCost),
      href: "/admin/finance/stock",
    });
  }
  t.sort((a, b) => a.date.getTime() - b.date.getTime() || a.key.localeCompare(b.key));
  return t;
}

export type StatementLine = Txn & { balance: number };

/**
 * The statement for a period: opening balance (everything before it), each movement with the
 * running balance, and the closing balance. `kinds` narrows which lines are listed — the balances
 * always count everything, so they stay true however it's filtered.
 */
export function statement(data: FinanceData, range: DateRange, opts: { kinds?: TxnKind[]; q?: string } = {}) {
  const txns = allTransactions(data);
  const before = range.from ? txns.filter((t) => dhakaDay(t.date) < range.from!) : [];
  const opening = before.reduce((s, t) => s + t.inAmount - t.outAmount, 0);

  let running = opening;
  const lines: StatementLine[] = [];
  const q = opts.q?.trim().toLowerCase();
  let moneyIn = 0;
  let moneyOut = 0;
  for (const t of txns.filter((t) => inRange(t.date, range))) {
    running += t.inAmount - t.outAmount;
    moneyIn += t.inAmount;
    moneyOut += t.outAmount;
    if (opts.kinds && !opts.kinds.includes(t.kind)) continue;
    if (q && ![t.title, t.party, t.category, t.method].join(" ").toLowerCase().includes(q)) continue;
    lines.push({ ...t, balance: running });
  }
  return { opening, closing: running, moneyIn, moneyOut, lines };
}

// ------------------------------------------------------------------------------ profit

export type Summary = {
  revenue: number;
  itemsRevenue: number;
  delivery: number;
  cogs: number;
  grossProfit: number;
  grossMargin: number;
  expenses: number;
  expensesByCategory: { category: string; amount: number; count: number }[];
  netProfit: number;
  netMargin: number;
  investments: number;
  stockPurchased: number;
  completedSales: number;
  onlineSales: number;
  manualSalesCount: number;
  unknownCostUnits: number;
};

export function summarize(data: FinanceData, range: DateRange): Summary {
  const done = data.sales.filter((s) => s.status === "COMPLETED" && inRange(s.date, range));
  const revenue = done.reduce((s, r) => s + r.revenue, 0);
  const cogs = done.reduce((s, r) => s + r.cogs, 0);
  const cats = new Map<string, { amount: number; count: number }>();
  let expenses = 0;
  for (const e of data.expenses) {
    if (!inRange(e.date, range)) continue;
    const amt = toNumber(e.amount);
    expenses += amt;
    const c = cats.get(e.category) ?? { amount: 0, count: 0 };
    c.amount += amt;
    c.count += 1;
    cats.set(e.category, c);
  }
  const netProfit = revenue - cogs - expenses;
  return {
    revenue,
    itemsRevenue: done.reduce((s, r) => s + r.itemsRevenue, 0),
    delivery: done.reduce((s, r) => s + r.delivery, 0),
    cogs,
    grossProfit: revenue - cogs,
    grossMargin: revenue > 0 ? ((revenue - cogs) / revenue) * 100 : 0,
    expenses,
    expensesByCategory: [...cats.entries()].map(([category, v]) => ({ category, ...v })).sort((a, b) => b.amount - a.amount),
    netProfit,
    netMargin: revenue > 0 ? (netProfit / revenue) * 100 : 0,
    investments: data.investments.filter((i) => inRange(i.date, range)).reduce((s, i) => s + toNumber(i.amount), 0),
    stockPurchased: data.purchases.filter((p) => inRange(p.purchaseDate, range)).reduce((s, p) => s + toNumber(p.totalCost), 0),
    completedSales: done.length,
    onlineSales: done.filter((s) => s.source === "ORDER").length,
    manualSalesCount: done.filter((s) => s.source === "MANUAL").length,
    unknownCostUnits: done.reduce((s, r) => s + r.unknownCostUnits, 0),
  };
}

/** Sales that aren't money yet — as of now, whatever the date range. */
export function outstanding(data: FinanceData) {
  const inProgress = data.sales.filter((s) => s.status === "IN_PROGRESS");
  const unpaid = data.sales.filter((s) => s.status === "UNPAID");
  return {
    inProgressCount: inProgress.length,
    inProgressAmount: inProgress.reduce((s, r) => s + r.revenue, 0),
    unpaidCount: unpaid.length,
    unpaidAmount: unpaid.reduce((s, r) => s + r.revenue, 0),
  };
}

export type MonthRow = {
  month: string;
  sales: number;
  revenue: number;
  cogs: number;
  grossProfit: number;
  expenses: number;
  netProfit: number;
  investments: number;
  stockPurchased: number;
};

/** One row per month across the range (all time: from the first entry to now), oldest first. */
export function monthly(data: FinanceData, range: DateRange): MonthRow[] {
  const dates: Date[] = [
    ...data.sales.filter((s) => s.status === "COMPLETED").map((s) => s.date),
    ...data.expenses.map((e) => e.date),
    ...data.investments.map((i) => i.date),
    ...data.purchases.map((p) => p.purchaseDate),
  ];
  const today = todayDhaka();
  const first = dates.length ? dhakaDay(new Date(Math.min(...dates.map((d) => d.getTime())))) : today;
  const from = range.from ?? first;
  const to = range.to ?? today;
  const months = monthsBetween(from, to > today && !range.to ? today : to);
  const rows = new Map<string, MonthRow>(
    months.map((m) => [m, { month: m, sales: 0, revenue: 0, cogs: 0, grossProfit: 0, expenses: 0, netProfit: 0, investments: 0, stockPurchased: 0 }]),
  );
  for (const s of data.sales) {
    if (s.status !== "COMPLETED") continue;
    const r = rows.get(dhakaMonth(s.date));
    if (!r) continue;
    r.sales += 1;
    r.revenue += s.revenue;
    r.cogs += s.cogs;
  }
  for (const e of data.expenses) {
    const r = rows.get(dhakaMonth(e.date));
    if (r) r.expenses += toNumber(e.amount);
  }
  for (const i of data.investments) {
    const r = rows.get(dhakaMonth(i.date));
    if (r) r.investments += toNumber(i.amount);
  }
  for (const p of data.purchases) {
    const r = rows.get(dhakaMonth(p.purchaseDate));
    if (r) r.stockPurchased += toNumber(p.totalCost);
  }
  for (const r of rows.values()) {
    r.grossProfit = r.revenue - r.cogs;
    r.netProfit = r.revenue - r.cogs - r.expenses;
  }
  return [...rows.values()];
}

/** Who has put what in, all time, and each owner's share of the net profit made so far. */
export function ownerSummary(data: FinanceData) {
  const invested = new Map<string, number>();
  const stock = new Map<string, number>();
  let totalInvested = 0;
  for (const i of data.investments) {
    const a = toNumber(i.amount);
    invested.set(i.ownerId, (invested.get(i.ownerId) ?? 0) + a);
    totalInvested += a;
  }
  for (const p of data.purchases) stock.set(p.ownerId, (stock.get(p.ownerId) ?? 0) + toNumber(p.totalCost));
  const everything = summarize(data, { from: null, to: null, preset: "all", label: "All time" });
  const rows = data.owners
    .map((o) => {
      const inv = invested.get(o.id) ?? 0;
      const share = totalInvested > 0 ? inv / totalInvested : 0;
      return { id: o.id, name: o.name, contact: o.contact, notes: o.notes, invested: inv, stockPaid: stock.get(o.id) ?? 0, share, profitShare: everything.netProfit * share };
    })
    .sort((a, b) => b.invested - a.invested);
  return { rows, totalInvested, netProfitAllTime: everything.netProfit };
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
