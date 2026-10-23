import "server-only";
import { inRange, todayDhaka, type DateRange } from "@/lib/finance-dates";
import { summarize, type ExpenseEntry, type FinanceData, type SaleRow, type Summary } from "@/lib/finance";
import type { StoreInfo } from "@/lib/store-settings";

/**
 * The formal statement for a period: one model that the on-screen preview, the print / PDF view and
 * the CSV download are all drawn from, so the three can never disagree.
 */

export type StatementView = "full" | "summary" | "sales" | "expenses";
export const STATEMENT_VIEWS: { id: StatementView; label: string }[] = [
  { id: "full", label: "Full statement (summary + both schedules)" },
  { id: "summary", label: "Summary only (profit & loss + notes)" },
  { id: "sales", label: "Summary + sales schedule" },
  { id: "expenses", label: "Summary + expenses schedule" },
];

export type StatementModel = {
  /** e.g. ST-20261023-4F2A — the day it was issued plus a short code for the period it covers. */
  number: string;
  store: StoreInfo;
  range: DateRange;
  generatedAt: Date;
  preparedBy: { name: string; email: string; role: string };
  view: StatementView;
  summary: Summary;
  /** Counted sales in the period, oldest first. */
  sales: SaleRow[];
  /** Expenses in the period, oldest first. */
  expenses: ExpenseEntry[];
  /** Orders placed in the period that aren't sales yet (Not Cleared Yet / Sent For Delivery, not paid in advance). */
  pending: { count: number; amount: number };
  /** Orders left out of the reports (e.g. test orders) with a date in the period. */
  removedCount: number;
};

function shortCode(text: string): string {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h.toString(16).toUpperCase().padStart(8, "0").slice(-4);
}

export function buildStatement(
  data: FinanceData,
  range: DateRange,
  ctx: { store: StoreInfo; preparedBy: StatementModel["preparedBy"]; view: StatementView },
): StatementModel {
  const summary = summarize(data, range);
  const sales = data.sales.filter((s) => s.counted && inRange(s.date, range)).sort((a, b) => a.date.getTime() - b.date.getTime());
  const expenses = data.expenses.filter((e) => inRange(e.date, range)).sort((a, b) => a.date.getTime() - b.date.getTime());
  const pendingRows = data.sales.filter((s) => !s.counted && ["NOT_CLEARED", "SHIPPED"].includes(s.status) && inRange(s.date, range));
  return {
    number: `ST-${todayDhaka().replace(/-/g, "")}-${shortCode(`${range.from ?? ""}|${range.to ?? ""}`)}`,
    store: ctx.store,
    range,
    generatedAt: new Date(),
    preparedBy: ctx.preparedBy,
    view: ctx.view,
    summary,
    sales,
    expenses,
    pending: { count: pendingRows.length, amount: pendingRows.reduce((t, r) => t + r.revenue, 0) },
    removedCount: data.removed.filter((s) => inRange(s.date, range)).length,
  };
}

/** Statement figures: two decimals, thousands separators, negatives in brackets — (1,250.00) — as accounts are written. */
export function fmt(n: number): string {
  const r = Math.round(n * 100) / 100;
  const s = Math.abs(r).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return r < 0 ? `(${s})` : s;
}

export function pctOf(part: number, whole: number): string {
  return whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : "—";
}
