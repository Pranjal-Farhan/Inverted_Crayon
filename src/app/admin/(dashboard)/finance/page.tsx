import Link from "next/link";
import { requireAdminPage } from "@/lib/admin-guard";
import { Kpi } from "@/components/admin/Kpi";
import { Panel } from "@/components/admin/Panel";
import { RangeBar } from "@/components/admin/finance/RangeBar";
import { Money } from "@/components/admin/finance/ui";
import { formatTaka, formatTakaSigned } from "@/lib/money";
import { loadFinance, monthly, outstanding, ownerSummary, statement, summarize } from "@/lib/finance";
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
  const out = outstanding(data);
  const cash = statement(data, { from: null, to: range.to, preset: "custom", label: "" });
  const owners = ownerSummary(data);

  // The monthly table shows the last 12 months when the chosen period is a single month or shorter.
  const short = ["this-month", "last-month", "30d", "90d"].includes(range.preset);
  const monthRange: DateRange = short ? { from: monthStart(shiftMonth(dhakaMonth(new Date()), -11)), to: todayDhaka(), preset: "custom", label: "Last 12 months" } : range;
  const months = monthly(data, monthRange);
  const maxAbs = Math.max(1, ...months.map((m) => Math.abs(m.netProfit)));
  const totals = months.reduce((t, m) => ({ sales: t.sales + m.sales, revenue: t.revenue + m.revenue, cogs: t.cogs + m.cogs, expenses: t.expenses + m.expenses, net: t.net + m.netProfit }), { sales: 0, revenue: 0, cogs: 0, expenses: 0, net: 0 });

  return (
    <div>
      <RangeBar basePath="/admin/finance" range={range} />

      <div className="mb-4 grid grid-cols-2 gap-4 desktop:grid-cols-4">
        <Kpi label="Revenue" value={formatTaka(sum.revenue)} accent="cyan" delta={`${sum.completedSales} completed ${sum.completedSales === 1 ? "sale" : "sales"}`} />
        <Kpi label="Cost of goods" value={formatTaka(sum.cogs)} accent="yellow" />
        <Kpi label="Expenses" value={formatTaka(sum.expenses)} accent="pink" delta={sum.shipmentCosts > 0 ? `incl. ${formatTaka(sum.shipmentCosts)} shipment costs` : `${sum.expensesByCategory.reduce((n, c) => n + c.count, 0)} entries`} />
        <Kpi label="Net profit" value={formatTakaSigned(sum.netProfit)} accent={sum.netProfit >= 0 ? "lime" : "pink"} delta={`${sum.netMargin.toFixed(1)}% of revenue`} />
      </div>
      <div className="mb-4.5 grid grid-cols-2 gap-4 desktop:grid-cols-4">
        <Kpi label="Gross profit" value={formatTakaSigned(sum.grossProfit)} accent="lime" delta={`${sum.grossMargin.toFixed(1)}% margin`} />
        <Kpi label="Cash collected" value={formatTaka(sum.cashCollected)} accent="cyan" delta={`${sum.cashCollectedCount} ${sum.cashCollectedCount === 1 ? "sale" : "sales"} paid up in this period`} />
        <Kpi label="Delivered — awaiting cash" value={formatTaka(out.awaitingCashAmount)} accent="yellow" delta={`${out.awaitingCashCount} ${out.awaitingCashCount === 1 ? "order" : "orders"} · all time`} />
        <Kpi label="Net cash" value={formatTakaSigned(cash.closing)} accent={cash.closing >= 0 ? "lime" : "pink"} delta={range.to ? "collected − spent, to end of period" : "cash collected − expenses − stock paid for"} />
      </div>

      {sum.unknownCostUnits > 0 && (
        <p className="mb-4.5 border border-yellow/40 bg-yellow/[0.07] px-3.5 py-2.5 text-[13px] text-yellow">
          {sum.unknownCostUnits} sold unit{sum.unknownCostUnits === 1 ? "" : "s"} in this period {sum.unknownCostUnits === 1 ? "has" : "have"} no purchase cost, so profit is overstated by their cost. Enter the <strong>Purchase cost</strong> on the product (open it from{" "}
          <Link href="/admin/products" className="underline">
            Products
          </Link>
          ), or type a cost on a manual sale, to fix it.
        </p>
      )}

      <div className="mb-4.5 grid grid-cols-1 gap-4.5 desktop:grid-cols-2">
        <Panel title={`Profit & loss — ${range.label}`}>
          <Row label="Product sales (after discounts)">
            <Money value={sum.itemsRevenue} tone="plain" />
          </Row>
          <Row label="Delivery charges collected">
            <Money value={sum.delivery} tone="plain" />
          </Row>
          <Row label="Revenue" strong>
            <Money value={sum.revenue} tone="plain" />
          </Row>
          <Row label="Cost of goods sold">
            <Money value={-sum.cogs} tone="out" />
          </Row>
          <Row label="Gross profit" strong>
            <Money value={sum.grossProfit} />
          </Row>
          {sum.expensesByCategory.map((c) => (
            <Row key={c.category} label={c.category} indent>
              <Money value={-c.amount} tone="out" />
            </Row>
          ))}
          <Row label="Total expenses">
            <Money value={-sum.expenses} tone="out" />
          </Row>
          <div className="flex items-baseline justify-between gap-4 pt-3">
            <span className="font-impact text-[17px] uppercase tracking-[0.5px]">Net profit</span>
            <span className="font-impact text-[24px]">
              <Money value={sum.netProfit} />
            </span>
          </div>
          <p className="mt-2 text-[12px] text-muted-2">
            Revenue counts an order when it is delivered or paid online, and a manual sale when it is marked paid; the cash itself counts from the day you mark it collected. Cancelled, refunded and returned orders are left out. Stock you pay for (investments) is not an expense until it sells — only the shipment cost counts against profit, in the month it was paid.
          </p>
        </Panel>

        <div className="space-y-4.5">
          <Panel title="Cash in & out">
            <Row label={`Cash collected from sales (${sum.cashCollectedCount})`}>
              <Money value={sum.cashCollected} tone="in" />
            </Row>
            <Row label="Expenses">
              <Money value={-sum.expenseEntries} tone="out" />
            </Row>
            <Row label="Investments — stock shipments paid for">
              <Money value={-sum.investments} tone="out" />
            </Row>
            <Row label="Net cash movement" strong>
              <Money value={sum.cashCollected - sum.expenseEntries - sum.investments} />
            </Row>
            <Row label="Net cash, all time (collected − expenses − stock paid for)" strong>
              <Money value={cash.closing} />
            </Row>
          </Panel>

          <Panel title="Not counted yet">
            <Row label={`Delivered, cash not collected yet (${out.awaitingCashCount})`}>
              <Money value={out.awaitingCashAmount} tone="plain" />
            </Row>
            <Row label={`Online orders still in progress (${out.inProgressCount})`}>
              <Money value={out.inProgressAmount} tone="plain" />
            </Row>
            <Row label={`Manual sales awaiting payment (${out.unpaidCount})`}>
              <Money value={out.unpaidAmount} tone="plain" />
            </Row>
            <p className="mt-2 text-[12px] text-muted-2">Delivered orders already count as sales; their cash counts once you mark it collected (on the order, or under Sales → Mark cash collected). In-progress orders become sales when delivered.</p>
          </Panel>
        </div>
      </div>

      <Panel title={`Monthly profit — ${monthRange.label}`} className="mb-4.5 !p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-line-2 text-left text-muted">
                {["Month", "Sales", "Revenue", "Cost of goods", "Expenses + shipping", "Net profit", ""].map((h, i) => (
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
                    <Money value={m.cogs} tone="plain" />
                  </td>
                  <td className="px-4 py-2.5 text-right text-muted">
                    <Money value={m.expenses} tone="plain" />
                  </td>
                  <td className="px-4 py-2.5 text-right font-medium">
                    <Money value={m.netProfit} />
                  </td>
                  <td className="w-[160px] px-4 py-2.5" aria-hidden>
                    <div className="h-2.5 w-full bg-line/60">
                      <div className={`h-full ${m.netProfit >= 0 ? "bg-lime" : "bg-error"}`} style={{ width: `${(Math.abs(m.netProfit) / maxAbs) * 100}%` }} />
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
                    <Money value={totals.cogs} tone="plain" />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Money value={totals.expenses} tone="plain" />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Money value={totals.net} />
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Panel>

      <div className="mb-4.5 grid grid-cols-1 gap-4.5 desktop:grid-cols-2">
        <Panel title="Owners (all time)">
          {owners.rows.length === 0 ? (
            <p className="text-sm text-muted">
              No owners yet. Add them under{" "}
              <Link href="/admin/finance/investments" className="text-cyan hover:underline">
                Investments
              </Link>
              .
            </p>
          ) : (
            <>
              {owners.rows.map((o) => (
                <Row key={o.id} label={o.name}>
                  <span className="text-muted">
                    <Money value={o.invested} tone="plain" /> invested in stock
                    {o.expensesPaid > 0 && (
                      <>
                        {" "}
                        · <Money value={o.expensesPaid} tone="plain" /> expenses
                      </>
                    )}
                  </span>
                </Row>
              ))}
              <p className="mt-2 text-[12px] text-muted-2">
                Total invested <Money value={owners.totalInvested} tone="plain" />
              </p>
            </>
          )}
        </Panel>

        <Panel title="Record something">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            {[
              ["/admin/finance/expenses", "+ Expense", "Rent, ads, packaging…"],
              ["/admin/finance/investments", "+ Investment", "A stock shipment you paid for"],
              ["/admin/finance/sales", "+ Sale", "Made outside the website"],
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
    </div>
  );
}
