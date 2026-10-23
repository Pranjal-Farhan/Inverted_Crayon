import type { ReactNode } from "react";
import { fmt, pctOf, type StatementModel } from "@/lib/statement";
import { formatDay, formatDayOf } from "@/lib/finance-dates";

/**
 * The statement as a document: letterhead, statement details, key figures, a profit & loss with
 * numbered notes, the two schedules behind the figures (every sale, every expense), the basis of
 * preparation and a sign-off block. It is drawn in black on white whether it is previewed on screen
 * or printed / saved as a PDF (A4, with the issuer and "Page x of y" in the footer of every page).
 *
 * Conventions: amounts in Bangladeshi Taka (BDT) to two decimals, right-aligned, negatives in
 * brackets; every total is ruled off; the grand total (Profit) is double-ruled.
 */

const th = "border-b border-black px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-[0.06em]";
const td = "border-b border-[#d9d9d9] px-2 py-1.5 align-top";
const num = "text-right tabular-nums whitespace-nowrap";

function Heading({ children, note }: { children: ReactNode; note?: string }) {
  return (
    <h2 className="mb-2 mt-7 flex items-baseline justify-between border-b-2 border-black pb-1 text-[12px] font-bold uppercase tracking-[0.08em] break-after-avoid">
      <span>{children}</span>
      {note && <span className="text-[10px] font-normal normal-case tracking-normal text-[#555]">{note}</span>}
    </h2>
  );
}

export function StatementDocument({ m }: { m: StatementModel }) {
  const { summary: s, store, range } = m;
  const period = range.from && range.to ? `${formatDay(range.from)} to ${formatDay(range.to)}` : range.from ? `${formatDay(range.from)} to date` : range.to ? `Up to ${formatDay(range.to)}` : "All time (from the first record to date)";
  const showSales = m.view === "full" || m.view === "sales";
  const showExpenses = m.view === "full" || m.view === "expenses";
  const salesTotal = m.sales.reduce((t, r) => t + r.revenue, 0);
  const salesCost = m.sales.reduce((t, r) => t + r.cogs, 0);
  const expensesTotal = m.expenses.reduce((t, e) => t + e.amount, 0);

  return (
    <article className="statement-doc mx-auto w-full max-w-[820px] bg-white p-9 text-[11px] leading-[1.45] text-black print:max-w-none print:p-0">
      {/* Page setup + running footer for print / PDF */}
      <style>{`
        @page { size: A4; margin: 16mm 14mm 20mm 14mm;
          @bottom-left { content: "${store.name.replace(/"/g, "'")} · Statement ${m.number}"; font-size: 8pt; color: #555; }
          @bottom-right { content: "Page " counter(page) " of " counter(pages); font-size: 8pt; color: #555; } }
        .statement-doc table { border-collapse: collapse; width: 100%; }
        .statement-doc thead { display: table-header-group; }
        .statement-doc tr { break-inside: avoid; }
        @media print { html, body { background: #fff !important; } }
      `}</style>

      {/* Letterhead */}
      <header className="flex items-start justify-between gap-8 border-b-2 border-black pb-4">
        <div>
          <div className="text-[22px] font-bold leading-tight tracking-tight">{store.name}</div>
          <div className="mt-1 text-[10.5px] text-[#444]">
            {store.address}
            <br />
            {store.phone} · {store.email}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[15px] font-bold uppercase tracking-[0.06em]">Statement of Income &amp; Expenses</div>
          <div className="mt-0.5 text-[10.5px] text-[#444]">Profit and loss for the period</div>
        </div>
      </header>

      {/* Statement details */}
      <dl className="mt-4 grid grid-cols-2 gap-x-8 gap-y-1 border border-black p-3 text-[10.5px]">
        {[
          ["Statement no.", m.number],
          ["Period covered", period],
          ["Date issued", formatDayOf(m.generatedAt)],
          ["Currency", "Bangladeshi Taka (BDT, ৳)"],
          ["Prepared by", `${m.preparedBy.name} (${m.preparedBy.role})`],
          ["Basis", "Sales counted when delivered or paid in advance"],
        ].map(([k, v]) => (
          <div key={k} className="flex gap-2">
            <dt className="w-[92px] shrink-0 text-[#555]">{k}</dt>
            <dd className="font-medium">{v}</dd>
          </div>
        ))}
      </dl>

      {/* Key figures */}
      <div className="mt-4 grid grid-cols-4 border border-black text-center">
        {[
          ["Total Sales", fmt(s.revenue)],
          ["Buying Cost", fmt(s.buyingCost)],
          ["Expenses", fmt(s.expenses)],
          ["Profit", fmt(s.profit)],
        ].map(([label, value], i) => (
          <div key={label} className={`px-2 py-2.5 ${i > 0 ? "border-l border-black" : ""} ${label === "Profit" ? "bg-[#f0f0f0]" : ""}`}>
            <div className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[#555]">{label}</div>
            <div className="mt-0.5 text-[15px] font-bold tabular-nums">৳ {value}</div>
          </div>
        ))}
      </div>

      {/* Profit & loss */}
      <Heading note="Amounts in BDT">Statement of profit or loss</Heading>
      <table>
        <thead>
          <tr>
            <th className={th}>Description</th>
            <th className={`${th} w-[44px]`}>Note</th>
            <th className={`${th} text-right w-[110px]`}>Amount (৳)</th>
            <th className={`${th} text-right w-[80px]`}>% of sales</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={td}>Products sold, after discounts</td>
            <td className={td}>1</td>
            <td className={`${td} ${num}`}>{fmt(s.itemsRevenue)}</td>
            <td className={`${td} ${num}`}>{pctOf(s.itemsRevenue, s.revenue)}</td>
          </tr>
          <tr>
            <td className={td}>Delivery charged to customers</td>
            <td className={td}>1</td>
            <td className={`${td} ${num}`}>{fmt(s.delivery)}</td>
            <td className={`${td} ${num}`}>{pctOf(s.delivery, s.revenue)}</td>
          </tr>
          <tr className="font-bold">
            <td className="border-b border-black px-2 py-1.5 border-t" colSpan={2}>Total Sales</td>
            <td className={`border-b border-black border-t px-2 py-1.5 ${num}`}>{fmt(s.revenue)}</td>
            <td className={`border-b border-black border-t px-2 py-1.5 ${num}`}>{s.revenue > 0 ? "100.0%" : "—"}</td>
          </tr>
          <tr>
            <td className={td}>Less: Buying Cost — purchase cost of the {s.countedSales === 1 ? "item" : "items"} sold</td>
            <td className={td}>2</td>
            <td className={`${td} ${num}`}>{fmt(-s.buyingCost)}</td>
            <td className={`${td} ${num}`}>{pctOf(s.buyingCost, s.revenue)}</td>
          </tr>
          <tr>
            <td className="px-2 pb-0.5 pt-2 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#555]" colSpan={4}>
              Less: Expenses
            </td>
          </tr>
          {s.expensesByCategory.length === 0 && (
            <tr>
              <td className={`${td} pl-5 text-[#777]`} colSpan={4}>
                No expenses recorded in this period
              </td>
            </tr>
          )}
          {s.expensesByCategory.map((c) => (
            <tr key={c.category}>
              <td className={`${td} pl-5`}>
                {c.category} <span className="text-[#777]">({c.count})</span>
              </td>
              <td className={td}>3</td>
              <td className={`${td} ${num}`}>{fmt(-c.amount)}</td>
              <td className={`${td} ${num}`}>{pctOf(c.amount, s.revenue)}</td>
            </tr>
          ))}
          <tr className="font-bold">
            <td className="border-b border-black px-2 py-1.5 border-t" colSpan={2}>Total expenses</td>
            <td className={`border-b border-black border-t px-2 py-1.5 ${num}`}>{fmt(-s.expenses)}</td>
            <td className={`border-b border-black border-t px-2 py-1.5 ${num}`}>{pctOf(s.expenses, s.revenue)}</td>
          </tr>
          <tr className="text-[12.5px] font-bold">
            <td className="px-2 py-2" colSpan={2}>
              {s.profit >= 0 ? "Profit for the period" : "Loss for the period"}
            </td>
            <td className={`border-b-[3px] border-double border-black px-2 py-2 ${num}`}>{fmt(s.profit)}</td>
            <td className={`px-2 py-2 ${num}`}>{s.revenue > 0 ? `${s.margin.toFixed(1)}%` : "—"}</td>
          </tr>
        </tbody>
      </table>

      {/* Schedule A */}
      {showSales && (
        <>
          <Heading note={`${m.sales.length} ${m.sales.length === 1 ? "sale" : "sales"} counted`}>Schedule A — Sales</Heading>
          <table className="text-[10px]">
            <thead>
              <tr>
                <th className={`${th} w-[74px]`}>Date</th>
                <th className={`${th} w-[92px]`}>Order no.</th>
                <th className={th}>Customer</th>
                <th className={th}>Products (qty × item · SKU)</th>
                <th className={`${th} text-right`}>Total sales</th>
                <th className={`${th} text-right`}>Buying cost</th>
                <th className={`${th} text-right`}>Profit</th>
              </tr>
            </thead>
            <tbody>
              {m.sales.map((r) => (
                <tr key={r.key}>
                  <td className={`${td} whitespace-nowrap`}>{formatDayOf(r.date)}</td>
                  <td className={`${td} whitespace-nowrap`}>
                    {r.ref}
                    <div className="text-[8.5px] uppercase tracking-wide text-[#777]">{r.source === "ONLINE" ? "Online" : "Recorded"}</div>
                  </td>
                  <td className={td}>{r.customerName}</td>
                  <td className={td}>
                    {r.lines.map((l, i) => (
                      <div key={i}>
                        {l.qty} × {l.title}
                        {l.variant ? ` (${l.variant})` : ""}
                        {l.sku ? ` · ${l.sku}` : ""}
                      </div>
                    ))}
                  </td>
                  <td className={`${td} ${num}`}>{fmt(r.revenue)}</td>
                  <td className={`${td} ${num}`}>{fmt(r.cogs)}</td>
                  <td className={`${td} ${num}`}>{fmt(r.profit)}</td>
                </tr>
              ))}
              {m.sales.length === 0 && (
                <tr>
                  <td className={`${td} text-center text-[#777]`} colSpan={7}>
                    No sales counted in this period
                  </td>
                </tr>
              )}
              <tr className="font-bold">
                <td className="border-t border-black px-2 py-1.5" colSpan={4}>
                  Total
                </td>
                <td className={`border-t border-black px-2 py-1.5 ${num}`}>{fmt(salesTotal)}</td>
                <td className={`border-t border-black px-2 py-1.5 ${num}`}>{fmt(salesCost)}</td>
                <td className={`border-t border-black px-2 py-1.5 ${num}`}>{fmt(salesTotal - salesCost)}</td>
              </tr>
            </tbody>
          </table>
        </>
      )}

      {/* Schedule B */}
      {showExpenses && (
        <>
          <Heading note={`${m.expenses.length} ${m.expenses.length === 1 ? "entry" : "entries"}`}>Schedule B — Expenses</Heading>
          <table className="text-[10px]">
            <thead>
              <tr>
                <th className={`${th} w-[74px]`}>Date</th>
                <th className={th}>Category</th>
                <th className={th}>Description</th>
                <th className={th}>Paid to</th>
                <th className={th}>Paid by</th>
                <th className={th}>Method</th>
                <th className={`${th} text-right`}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {m.expenses.map((e) => (
                <tr key={e.id}>
                  <td className={`${td} whitespace-nowrap`}>{formatDayOf(e.date)}</td>
                  <td className={td}>{e.category}</td>
                  <td className={td}>
                    {e.title}
                    {e.notes && <div className="text-[9px] text-[#666]">{e.notes}</div>}
                  </td>
                  <td className={td}>{e.paidTo || "—"}</td>
                  <td className={td}>{e.ownerName || "—"}</td>
                  <td className={td}>{e.method}</td>
                  <td className={`${td} ${num}`}>{fmt(e.amount)}</td>
                </tr>
              ))}
              {m.expenses.length === 0 && (
                <tr>
                  <td className={`${td} text-center text-[#777]`} colSpan={7}>
                    No expenses recorded in this period
                  </td>
                </tr>
              )}
              <tr className="font-bold">
                <td className="border-t border-black px-2 py-1.5" colSpan={6}>
                  Total
                </td>
                <td className={`border-t border-black px-2 py-1.5 ${num}`}>{fmt(expensesTotal)}</td>
              </tr>
            </tbody>
          </table>
        </>
      )}

      {/* Notes */}
      <Heading>Notes to the statement</Heading>
      <ol className="list-decimal space-y-1.5 pl-5 text-[10px] text-[#222]">
        <li>
          <strong>Basis of preparation.</strong> Every order — from the website or recorded by hand — is a sale. It is counted in Total Sales once it is <em>Delivered</em>, or has been paid in advance, and has not since been cancelled, refunded or returned; it is dated by its delivery date (or placing date when paid up front), in Bangladesh time. Total Sales is the order total: products after discounts plus delivery charged.
        </li>
        <li>
          <strong>Buying Cost</strong> is the purchase cost recorded on each product, multiplied by the units sold on counted sales.
          {s.unknownCostUnits > 0 ? ` ${s.unknownCostUnits} sold unit${s.unknownCostUnits === 1 ? " has" : "s have"} no purchase cost recorded, so Profit is overstated by their cost.` : " Every unit sold has a recorded purchase cost."}
        </li>
        <li>
          <strong>Expenses</strong> are the entries recorded under Finance → Expenses, by the date shown, filed under categories created by the business. The price of the goods themselves is not an expense — it is the Buying Cost once sold — but the freight, customs and handling of stock are.
        </li>
        <li>
          <strong>Profit</strong> = Total Sales − Buying Cost − Expenses. It is stated before any tax and before owner drawings.
        </li>
        {m.pending.count > 0 && (
          <li>
            <strong>Not yet counted.</strong> {m.pending.count} order{m.pending.count === 1 ? "" : "s"} placed in this period, worth ৳ {fmt(m.pending.amount)}, {m.pending.count === 1 ? "is" : "are"} still Not Cleared Yet or Sent For Delivery and not paid in advance; {m.pending.count === 1 ? "it becomes" : "they become"} sales when delivered.
          </li>
        )}
        {m.removedCount > 0 && (
          <li>
            <strong>Left out.</strong> {m.removedCount} order{m.removedCount === 1 ? " was" : "s were"} removed from the finance reports (for example test orders) and {m.removedCount === 1 ? "is" : "are"} not included above.
          </li>
        )}
        <li>Figures are rounded to two decimal places; brackets denote a deduction or a negative amount.</li>
      </ol>

      {/* Sign-off */}
      <div className="mt-8 grid grid-cols-2 gap-10 break-inside-avoid text-[10px]">
        <div>
          <div className="h-10 border-b border-black" />
          <div className="mt-1 font-semibold">Prepared by</div>
          <div className="text-[#555]">
            {m.preparedBy.name} · {formatDayOf(m.generatedAt)}
          </div>
        </div>
        <div>
          <div className="h-10 border-b border-black" />
          <div className="mt-1 font-semibold">Reviewed and approved by</div>
          <div className="text-[#555]">Name · Signature · Date</div>
        </div>
      </div>
      <p className="mt-5 border-t border-[#d9d9d9] pt-2 text-[9px] text-[#666]">
        This statement was generated from {store.name}&apos;s own records on {formatDayOf(m.generatedAt)} and covers the period shown above only. Figures reflect the records as they stood when it was generated.
      </p>
    </article>
  );
}
