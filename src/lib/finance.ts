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
 *  COST OF GOODS — each unit sold costs the product's purchase cost, typed on the product itself
 *  (admin → Products → edit → Purchase cost); every size and colour costs the same. A manual-sale item
 *  can override it with its own typed cost. Units with no known cost are counted and flagged rather
 *  than guessed.
 *
 *  INVESTMENTS — each one is a stock shipment an owner paid for: the items (what each unit cost) plus
 *  the shipment's own cost (freight, customs…). It counts as the stock purchase — money out — and
 *  puts the units on the shelf. The goods are NOT an expense when bought: they become a cost only
 *  when sold, through cost of goods. The shipment cost is: it counts against profit in the period
 *  the shipment was paid (a "Shipment costs" line next to the expenses).
 *
 *  NET PROFIT = revenue − cost of goods − expenses − shipment costs.
 *
 *  CASH — what is actually in hand. A sale's money counts from the day it was collected: for cash on
 *  delivery that's the day "cash collected" was marked on the order (a delivered order is a sale
 *  straight away but shows as "awaiting cash" until then); online-paid orders and paid manual sales
 *  count from the sale day. Net cash = cash collected − expenses − investments (stock shipments paid).
 *
 *  REMOVED — an order can be left out of every report (a test order, say) without touching the order.
 */

export type SaleStatus = "COMPLETED" | "IN_PROGRESS" | "UNPAID" | "LOST";
/** Where a sale's money is: COLLECTED = in hand, AWAITING = delivered but not collected yet, NONE = nothing to collect (yet). */
export type CashStatus = "COLLECTED" | "AWAITING" | "NONE";

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
  cashStatus: CashStatus;
  /** The day the money came in, when it has. */
  cashAt: Date | null;
  /** True when "cash collected" was marked by hand on an online order (so it can be undone). */
  cashMarked: boolean;
};

export type TxnKind = "SALE" | "EXPENSE" | "INVESTMENT";

export type Txn = {
  key: string;
  kind: TxnKind;
  /** Which entry to open or edit. */
  id: string;
  date: Date;
  title: string;
  /** The other side: the customer, vendor or supplier. */
  party: string;
  /** The owner who made / paid it (expenses, investments). */
  owner: string;
  category: string;
  method: string;
  inAmount: number;
  outAmount: number;
  href: string;
};

export const KIND_LABEL: Record<TxnKind, string> = {
  SALE: "Cash collected",
  EXPENSE: "Expense",
  INVESTMENT: "Investment",
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
  const [orders, manualSales, expenses, allInvestments, owners, products] = await Promise.all([
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
        cashCollectedAt: true,
        excludeFromFinance: true,
        email: true,
        phone: true,
        shippingFullName: true,
        items: { select: { productId: true, variantId: true, productTitleSnapshot: true, variantLabelSnapshot: true, qty: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.manualSale.findMany({ include: { items: true }, orderBy: { date: "desc" } }),
    db.expense.findMany({ include: { owner: true }, orderBy: { date: "desc" } }),
    db.investment.findMany({ include: { owner: true, items: { orderBy: { id: "asc" } } }, orderBy: [{ date: "desc" }, { createdAt: "desc" }] }),
    db.stockOwner.findMany({ orderBy: { createdAt: "asc" } }),
    db.product.findMany({ select: { id: true, purchaseCost: true, variants: { select: { id: true } } } }),
  ]);

  // Entries from before investments became shipments are kept for the record but never counted.
  const investments = allInvestments.filter((i) => !i.legacyCapital);
  const legacyCapital = allInvestments.filter((i) => i.legacyCapital);

  // What one unit costs the business: the purchase cost typed on the product (admin → Products →
  // edit → Purchase cost). Every size and colour of a product costs the same; a product with no
  // cost entered yet is "unknown", and the reports flag those units instead of guessing.
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
    const completed = !lost && (o.status === "DELIVERED" || o.paymentStatus === "PAID");
    const status: SaleStatus = lost ? "LOST" : completed ? "COMPLETED" : "IN_PROGRESS";
    const date = completed ? (o.deliveredAt ?? (o.status === "DELIVERED" ? o.updatedAt : o.createdAt)) : o.createdAt;
    let cogs = 0;
    let unknown = 0;
    for (const i of o.items) {
      const c = unitCostOf(i);
      if (c === null) unknown += i.qty;
      else cogs += c * i.qty;
    }
    const revenue = toNumber(o.total);
    const delivery = toNumber(o.shippingCost);
    // Money in hand: when cash was marked collected, or (paid online) from the day it was placed.
    // A cancelled/refunded order has none — the money went back.
    const cashAt = lost ? null : (o.cashCollectedAt ?? (o.paymentStatus === "PAID" ? o.createdAt : null));
    const cashStatus: CashStatus = cashAt ? "COLLECTED" : o.status === "DELIVERED" ? "AWAITING" : "NONE";
    const row: SaleRow = {
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
      cashStatus,
      cashAt,
      cashMarked: o.cashCollectedAt != null,
    };
    (o.excludeFromFinance ? removed : sales).push(row);
  }

  for (const m of manualSales) {
    let cogs = 0;
    let unknown = 0;
    for (const i of m.items) {
      const c = i.unitCost != null ? toNumber(i.unitCost) : unitCostOf(i);
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
      cashStatus: m.paid ? "COLLECTED" : "NONE",
      cashAt: m.paid ? m.date : null,
      cashMarked: false,
    });
  }
  sales.sort((a, b) => b.date.getTime() - a.date.getTime());

  removed.sort((a, b) => b.date.getTime() - a.date.getTime());
  return { orders, manualSales, expenses, investments, legacyCapital, owners, sales, removed, unitCostOf, productCost };
}

// ------------------------------------------------------------------------------ the ledger

/** What a shipment contains, in one line: "20× Crown Jeans (M / Cyan), 5× …". */
export function investmentSummary(items: { quantity: number; productTitleSnapshot: string; variantLabelSnapshot: string }[]): string {
  if (items.length === 0) return "Stock shipment";
  const parts = items.slice(0, 3).map((i) => `${i.quantity}× ${i.productTitleSnapshot} (${i.variantLabelSnapshot})`);
  return parts.join(", ") + (items.length > 3 ? ` + ${items.length - 3} more` : "");
}

/** Every movement of money, oldest first: cash collected from sales in; expenses and investments (stock shipments paid for) out. */
export function allTransactions(data: FinanceData): Txn[] {
  const t: Txn[] = [];
  // Money in from sales is dated by when it came in, not when the order was delivered.
  for (const s of data.sales) {
    if (s.cashStatus !== "COLLECTED" || !s.cashAt) continue;
    t.push({
      key: s.key,
      kind: "SALE",
      id: s.id,
      date: s.cashAt,
      title: `${s.source === "ORDER" ? "Order" : "Manual sale"} ${s.ref}`,
      party: s.customerName,
      owner: "",
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
      owner: e.owner?.name ?? "",
      category: e.category,
      method: METHOD_LABEL[e.method] ?? e.method,
      inAmount: 0,
      outAmount: toNumber(e.amount),
      href: "/admin/finance/expenses",
    });
  }
  // An investment is a stock shipment paid for: money out, in one line, whatever is in it.
  for (const i of data.investments) {
    t.push({
      key: `investment:${i.id}`,
      kind: "INVESTMENT",
      id: i.id,
      date: i.date,
      title: i.description?.trim() || investmentSummary(i.items),
      party: i.supplierName ?? "",
      owner: i.owner.name,
      category: "Stock shipment",
      method: METHOD_LABEL[i.method] ?? i.method,
      inAmount: 0,
      outAmount: toNumber(i.amount),
      href: "/admin/finance/investments",
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
    if (q && ![t.title, t.party, t.owner, t.category, t.method].join(" ").toLowerCase().includes(q)) continue;
    lines.push({ ...t, balance: running });
  }
  // Delivered in this period but the cash isn't in yet — not money, so not on the ledger above.
  const awaiting = data.sales.filter((x) => x.cashStatus === "AWAITING" && inRange(x.date, range));
  return { opening, closing: running, moneyIn, moneyOut, lines, awaiting };
}

// ------------------------------------------------------------------------------ profit

export type Summary = {
  revenue: number;
  itemsRevenue: number;
  delivery: number;
  cogs: number;
  grossProfit: number;
  grossMargin: number;
  /** Everything counted against profit: the expense entries plus the shipment costs. */
  expenses: number;
  /** Just the entries on the Expenses page (what left in cash as expenses). */
  expenseEntries: number;
  /** The freight/customs part of the shipments paid in the period. */
  shipmentCosts: number;
  expensesByCategory: { category: string; amount: number; count: number }[];
  netProfit: number;
  netMargin: number;
  /** Everything paid for stock shipments in the period — goods and shipment cost; money out. */
  investments: number;
  completedSales: number;
  onlineSales: number;
  manualSalesCount: number;
  unknownCostUnits: number;
  /** Sale money that came in during the period (see CASH above). */
  cashCollected: number;
  cashCollectedCount: number;
};

/** Shown in the profit & loss next to the expense categories. */
export const SHIPMENT_CATEGORY = "Shipment costs (stock)";

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
  const expenseEntries = expenses;
  const shipped = data.investments.filter((i) => inRange(i.date, range));
  const shipmentCosts = shipped.reduce((t, i) => t + toNumber(i.shipmentCost), 0);
  const withCost = shipped.filter((i) => toNumber(i.shipmentCost) > 0).length;
  if (shipmentCosts > 0) cats.set(SHIPMENT_CATEGORY, { amount: shipmentCosts, count: withCost });
  expenses += shipmentCosts;
  const netProfit = revenue - cogs - expenses;
  const collected = data.sales.filter((x) => x.cashStatus === "COLLECTED" && x.cashAt && inRange(x.cashAt, range));
  return {
    cashCollected: collected.reduce((t, x) => t + x.revenue, 0),
    cashCollectedCount: collected.length,
    revenue,
    itemsRevenue: done.reduce((s, r) => s + r.itemsRevenue, 0),
    delivery: done.reduce((s, r) => s + r.delivery, 0),
    cogs,
    grossProfit: revenue - cogs,
    grossMargin: revenue > 0 ? ((revenue - cogs) / revenue) * 100 : 0,
    expenses,
    expenseEntries,
    shipmentCosts,
    expensesByCategory: [...cats.entries()].map(([category, v]) => ({ category, ...v })).sort((a, b) => b.amount - a.amount),
    netProfit,
    netMargin: revenue > 0 ? (netProfit / revenue) * 100 : 0,
    investments: shipped.reduce((s, i) => s + toNumber(i.amount), 0),
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
  const awaiting = data.sales.filter((s) => s.cashStatus === "AWAITING");
  return {
    awaitingCashCount: awaiting.length,
    awaitingCashAmount: awaiting.reduce((t, r) => t + r.revenue, 0),
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
  /** Paid for stock shipments that month (money out). */
  investments: number;
};

/** One row per month across the range (all time: from the first entry to now), oldest first. */
export function monthly(data: FinanceData, range: DateRange): MonthRow[] {
  const dates: Date[] = [
    ...data.sales.filter((s) => s.status === "COMPLETED").map((s) => s.date),
    ...data.expenses.map((e) => e.date),
    ...data.investments.map((i) => i.date),
  ];
  const today = todayDhaka();
  const first = dates.length ? dhakaDay(new Date(Math.min(...dates.map((d) => d.getTime())))) : today;
  const from = range.from ?? first;
  const to = range.to ?? today;
  const months = monthsBetween(from, to > today && !range.to ? today : to);
  const rows = new Map<string, MonthRow>(
    months.map((m) => [m, { month: m, sales: 0, revenue: 0, cogs: 0, grossProfit: 0, expenses: 0, netProfit: 0, investments: 0 }]),
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
    if (!r) continue;
    r.investments += toNumber(i.amount);
    // The shipment's own cost is a cost of the month it was paid; the goods become cost when sold.
    r.expenses += toNumber(i.shipmentCost);
  }
  for (const r of rows.values()) {
    r.grossProfit = r.revenue - r.cogs;
    r.netProfit = r.revenue - r.cogs - r.expenses;
  }
  return [...rows.values()];
}

/** Who has paid what, all time: stock shipments (investments) and expenses. */
export function ownerSummary(data: FinanceData) {
  const invested = new Map<string, number>();
  const shipments = new Map<string, number>();
  const expenses = new Map<string, number>();
  let totalInvested = 0;
  for (const i of data.investments) {
    const a = toNumber(i.amount);
    invested.set(i.ownerId, (invested.get(i.ownerId) ?? 0) + a);
    shipments.set(i.ownerId, (shipments.get(i.ownerId) ?? 0) + 1);
    totalInvested += a;
  }
  for (const e of data.expenses) if (e.ownerId) expenses.set(e.ownerId, (expenses.get(e.ownerId) ?? 0) + toNumber(e.amount));
  const rows = data.owners
    .map((o) => ({
      id: o.id,
      name: o.name,
      contact: o.contact,
      notes: o.notes,
      invested: invested.get(o.id) ?? 0,
      shipments: shipments.get(o.id) ?? 0,
      expensesPaid: expenses.get(o.id) ?? 0,
    }))
    .sort((a, b) => b.invested - a.invested);
  return { rows, totalInvested };
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
