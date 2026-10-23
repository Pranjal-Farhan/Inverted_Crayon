import Link from "next/link";
import { requireAdminPage } from "@/lib/admin-guard";
import { Kpi } from "@/components/admin/Kpi";
import { Panel } from "@/components/admin/Panel";
import { RangeBar } from "@/components/admin/finance/RangeBar";
import { Money } from "@/components/admin/finance/ui";
import { formatTaka, formatTakaSigned } from "@/lib/money";
import { loadFinance, monthly, summarize } from "@/lib/finance";
import { monthLabel, resolveRange, shiftMonth, dhakaMonth, todayDhaka, monthStart, type DateRange } from "@/lib/finance-dates";

type Props = { searchParams: Promise<{ range?: string; from?: string; to?: string }> };

const Row = ({ label, children, strong = false, indent = false }: { label: React.ReactNode; children: React.ReactNode; strong?: boolean; indent?: boolean }) => (
  <div className={`flex items-baseline justify-between gap-4 border-b border-line py-2 text-sm ${strong ? "font-medium" : ""} ${indent ? "pl-4 text-muted" : ""}`}>
    <span>{label}</span>
    <span className="tabular-nums">{children}</span>
  </div>
);

export default async function FinanceOverviewPage({ searchParams }: Props) {
  await requireAdminPage("finance");
  const range = resolveRange(await searchParams);
  const data = await loadFinance();
  const sum = summarize(data, range);

  // The monthly table shows the last 12 months when the chosen period is a single month or shorter.
  const short = ["this-month", "last-month", "30d", "90d"].includes(range.preset);
  const monthRange: DateRange = short ? { from: monthStart(shiftMonth(dhakaMonth(new Date()), -11)), to: todayDhaka(), preset: "custom", label: "Last 12 months" } : range;
  const months = monthly(data, monthRange);
  const maxAbs = Math.max(1, ...months.map((m) => Math.abs(m.profit)));
  const totals = months.reduce(
    (t, m) => ({ sales: t.sales + m.sales, revenue: t.revenue + m.revenue, buying: t.buying + m.buyingCost, expenses: t.expenses + m.expenses, profit: t.profit + m.profit }),
    { sales: 0, revenue: 0, buying: 0, expenses: 0, profit: 0 },
  );

  // Where each ৳ of Total Sales went — only meaningful when there were sales.
  const pct = (n: number) => (sum.revenue > 0 ? Math.max(0, Math.min(100, (n / sum.revenue) * 100)) : 0);
  const buyingPct = pct(sum.buyingCost);
  const expensesPct = Math.min(100 - buyingPct, pct(sum.expenses));
  const profitPct = Math.max(0, 100 - buyingPct - expensesPct);

  return (
    <div>
      <RangeBar basePath="/admin/finance" range={range} />

      <div className="mb-4.5 grid grid-cols-2 gap-4 desktop:grid-cols-4">
        <Kpi label="Total Sales" value={formatTaka(sum.revenue)} accent="cyan" delta={`${sum.countedSales} ${sum.countedSales === 1 ? "sale" : "sales"} · ${sum.onlineSales} online, ${sum.recordedSales} recorded`} />
        <Kpi label="Buying Cost" value={formatTaka(sum.buyingCost)} accent="yellow" delta="what the items sold cost to buy" />
        <Kpi label="Expenses" value={formatTaka(sum.expenses)} accent="pink" delta={`${sum.expenseCount} ${sum.expenseCount === 1 ? "entry" : "entries"}`} />
        <Kpi label="Profit" value={formatTakaSigned(sum.profit)} accent={sum.profit >= 0 ? "lime" : "pink"} delta={sum.revenue > 0 ? `${sum.margin.toFixed(1)}% of Total Sales` : "no sales in this period"} />
      </div>

      {sum.unknownCostUnits > 0 && (
        <p className="mb-4.5 border border-yellow/40 bg-yellow/[0.07] px-3.5 py-2.5 text-[13px] text-yellow">
          {sum.unknownCostUnits} sold unit{sum.unknownCostUnits === 1 ? "" : "s"} in this period {sum.unknownCostUnits === 1 ? "has" : "have"} no purchase cost, so Profit is overstated by their cost. Enter the <strong>Purchase cost</strong> on the product (open it from{" "}
          <Link href="/admin/products" className="underline">
            Products
          </Link>
          ) to fix it.
        </p>
      )}

      <div className="mb-4.5 grid grid-cols-1 gap-4.5 desktop:grid-cols-[1.35fr_1fr]">
        <Panel title={`Profit & loss — ${range.label}`}>
          <Row label="Products sold (after discounts)">
            <Money value={sum.itemsRevenue} tone="plain" />
          </Row>
          <Row label="Delivery charged">
            <Money value={sum.delivery} tone="plain" />
          </Row>
          <Row label="Total Sales" strong>
            <Money value={sum.revenue} tone="plain" />
          </Row>
          <Row label="Buying Cost">
            <Money value={-sum.buyingCost} tone="out" />
          </Row>
          {sum.expensesByCategory.map((c) => (
            <Row key={c.category} label={c.category} indent>
              <Money value={-c.amount} tone="out" />
            </Row>
          ))}
          <Row label="Expenses">
            <Money value={-sum.expenses} tone="out" />
          </Row>
          <div className="flex items-baseline justify-between gap-4 pt-3">
            <span className="font-impact text-[17px] uppercase tracking-[0.5px]">Profit</span>
            <span className="font-impact text-[24px]">
              <Money value={sum.profit} />
            </span>
          </div>
          <p className="mt-2 text-[12px] text-muted-2">
            An order is a sale once it is <strong>Delivered</strong> (or paid in advance) — Cancelled, Refunded and Returned orders are left out. Buying Cost is the purchase cost of each product sold. Expenses are everything else you entered, including freight and customs on stock.
          </p>
        </Panel>

        <div className="space-y-4.5">
          <Panel title="Where Total Sales went">
            {sum.revenue > 0 ? (
              <>
                <div className="flex h-4 w-full overflow-hidden border border-line-2" role="img" aria-label={`Buying cost ${buyingPct.toFixed(0)}%, expenses ${expensesPct.toFixed(0)}%, profit ${profitPct.toFixed(0)}% of total sales`}>
                  <div className="bg-yellow" style={{ width: `${buyingPct}%` }} />
                  <div className="bg-pink" style={{ width: `${expensesPct}%` }} />
                  <div className="bg-lime" style={{ width: `${profitPct}%` }} />
                </div>
                <div className="mt-3 space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="flex items-center gap-2"><span className="inline-block h-2.5 w-2.5 bg-yellow" /> Buying Cost</span>
                    <span className="tabular-nums text-muted">{buyingPct.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="flex items-center gap-2"><span className="inline-block h-2.5 w-2.5 bg-pink" /> Expenses</span>
                    <span className="tabular-nums text-muted">{pct(sum.expenses).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="flex items-center gap-2"><span className="inline-block h-2.5 w-2.5 bg-lime" /> Profit</span>
                    <span className="tabular-nums text-muted">{sum.margin.toFixed(1)}%</span>
                  </div>
                </div>
                {sum.profit < 0 && <p className="mt-2 text-[12px] text-error">Buying Cost and Expenses together are more than Total Sales in this period.</p>}
              </>
            ) : (
              <p className="text-sm text-muted">No sales counted in this period yet.</p>
            )}
          </Panel>

          <Panel title="Expenses paid by owner">
            {sum.expensesByOwner.length === 0 ? (
              <p className="text-sm text-muted">
                No expenses in this period.{" "}
                <Link href="/admin/finance/expenses" className="text-cyan hover:underline">
                  Add one
                </Link>
                .
              </p>
            ) : (
              sum.expensesByOwner.map((o) => (
                <Row key={o.owner} label={<span>{o.owner} <span className="text-[12px] text-muted-2">· {o.count}</span></span>}>
                  <Money value={o.amount} tone="plain" />
                </Row>
              ))
            )}
          </Panel>
        </div>
      </div>

      <Panel className="mb-4.5 !p-0">
        <h3 className="font-impact px-4.5 pb-1 pt-4 text-[17px] uppercase tracking-[0.5px]">Month by month — {monthRange.label}</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-line-2 text-left text-muted">
                {["Month", "Sales", "Total Sales", "Buying Cost", "Expenses", "Profit", ""].map((h, i) => (
                  <th key={i} className={`font-label px-4 py-2.5 text-[13px] tracking-[0.8px] ${i >= 1 && i <= 5 ? "text-right" : ""}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...months].reverse().map((m) => (
                <tr key={m.month} className="border-b border-line">
                  <td className="whitespace-nowrap px-4 py-2.5">{monthLabel(m.month)}</td>
                  <td className="px-4 py-2.5 text-right">{m.sales}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Money value={m.revenue} tone="plain" />
                  </td>
                  <td className="px-4 py-2.5 text-right text-muted">
                    <Money value={m.buyingCost} tone="plain" />
                  </td>
                  <td className="px-4 py-2.5 text-right text-muted">
                    <Money value={m.expenses} tone="plain" />
                  </td>
                  <td className="px-4 py-2.5 text-right font-medium">
                    <Money value={m.profit} />
                  </td>
                  <td className="w-[160px] px-4 py-2.5" aria-hidden>
                    <div className="h-2.5 w-full bg-line/60">
                      <div className={`h-full ${m.profit >= 0 ? "bg-lime" : "bg-error"}`} style={{ width: `${(Math.abs(m.profit) / maxAbs) * 100}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
              {months.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-muted">
                    Nothing recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
            {months.length > 1 && (
              <tfoot>
                <tr className="border-t border-line-2 font-medium">
                  <td className="px-4 py-3">Total</td>
                  <td className="px-4 py-3 text-right">{totals.sales}</td>
                  <td className="px-4 py-3 text-right">
                    <Money value={totals.revenue} tone="plain" />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Money value={totals.buying} tone="plain" />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Money value={totals.expenses} tone="plain" />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Money value={totals.profit} />
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Panel>

      <Panel title="Record something">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {[
            ["/admin/finance/expenses", "+ Expense", "Rent, ads, packaging, freight on stock…"],
            ["/admin/finance/sales", "+ Sale", "Made outside the website"],
            ["/admin/inventory", "Stock coming in?", "Add units under Inventory"],
          ].map(([href, title, sub]) => (
            <Link key={href} href={href} prefetch={false} className="border border-line-2 p-3.5 hover:border-lime">
              <div className="font-impact text-[16px]">{title}</div>
              <div className="mt-0.5 text-[12px] text-muted">{sub}</div>
            </Link>
          ))}
        </div>
        <p className="mt-3 text-[13px] text-muted">
          Online orders need no entry — every order from the website appears under{" "}
          <Link href="/admin/finance/sales" className="text-cyan hover:underline">
            Sales
          </Link>{" "}
          automatically and counts once it is delivered.
        </p>
      </Panel>
    </div>
  );
}
