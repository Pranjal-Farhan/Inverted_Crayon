import { requireAdminPage } from "@/lib/admin-guard";
import { Kpi } from "@/components/admin/Kpi";
import { Panel } from "@/components/admin/Panel";
import { RangeBar } from "@/components/admin/finance/RangeBar";
import { StatementActions } from "@/components/admin/finance/StatementActions";
import { KindChip, Money } from "@/components/admin/finance/ui";
import { KIND_LABEL, loadFinance, statement, summarize, type TxnKind } from "@/lib/finance";
import { formatDayOf, resolveRange, rangeQuery } from "@/lib/finance-dates";
import { formatTaka, formatTakaSigned } from "@/lib/money";
import { getStoreInfo } from "@/lib/store-settings";
import Link from "next/link";

type Props = { searchParams: Promise<{ range?: string; from?: string; to?: string; type?: string; q?: string }> };

const TYPE_FILTERS: Record<string, { label: string; kinds?: TxnKind[] }> = {
  all: { label: "Everything" },
  sales: { label: "Cash collected from sales", kinds: ["SALE"] },
  expenses: { label: "Expenses", kinds: ["EXPENSE"] },
  investments: { label: "Investments (stock shipments)", kinds: ["INVESTMENT"] },
};

export default async function FinanceStatementPage({ searchParams }: Props) {
  await requireAdminPage("finance");
  const sp = await searchParams;
  const range = resolveRange(sp);
  const type = TYPE_FILTERS[sp.type ?? ""] ? sp.type! : "all";
  const q = sp.q?.trim() ?? "";

  const [data, store] = await Promise.all([loadFinance(), getStoreInfo()]);
  const st = statement(data, range, { kinds: TYPE_FILTERS[type].kinds, q });
  const sum = summarize(data, range);
  const listedIn = st.lines.reduce((s, l) => s + l.inAmount, 0);
  const listedOut = st.lines.reduce((s, l) => s + l.outAmount, 0);
  const exportHref = `/admin/finance/export${rangeQuery(range, { type: type === "all" ? undefined : type, q: q || undefined })}`;

  return (
    <div>
      <RangeBar basePath="/admin/finance/statement" range={range} keep={{ type: type === "all" ? undefined : type, q: q || undefined }} />

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-impact text-[22px] uppercase tracking-[0.5px]">Statement — {range.label}</h2>
          <p className="text-[13px] text-muted">
            {store.name} · every cash collected, expense and investment (stock shipment paid for){range.from || range.to ? " in this period" : ""}, with the running balance. Generated {formatDayOf(new Date())}.
          </p>
        </div>
        <StatementActions exportHref={exportHref} />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4 desktop:grid-cols-4">
        <Kpi label="Opening balance" value={formatTakaSigned(st.opening)} accent="yellow" delta={range.from ? "before this period" : "start"} />
        <Kpi label="Money in" value={formatTaka(st.moneyIn)} accent="lime" delta="cash collected from sales" />
        <Kpi label="Money out" value={formatTaka(st.moneyOut)} accent="pink" delta="expenses + stock shipments paid" />
        <Kpi label="Closing balance" value={formatTakaSigned(st.closing)} accent="cyan" />
      </div>

      <Panel title="Profit for this period" className="mb-4.5">
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm desktop:grid-cols-5">
          {[
            ["Revenue", sum.revenue, "plain"],
            ["Cost of goods", -sum.cogs, "out"],
            ["Gross profit", sum.grossProfit, "auto"],
            ["Expenses", -sum.expenses, "out"],
            ["Net profit", sum.netProfit, "auto"],
          ].map(([label, value, tone]) => (
            <div key={label as string}>
              <div className="font-label text-[12px] tracking-[1px] text-muted">{(label as string).toUpperCase()}</div>
              <div className="text-[17px]">
                <Money value={value as number} tone={tone as "plain" | "out" | "auto"} />
              </div>
            </div>
          ))}
        </div>
      </Panel>

      {st.awaiting.length > 0 && (
        <p className="mb-4 border border-yellow/40 bg-yellow/[0.07] px-3.5 py-2.5 text-[13px] text-yellow">
          {st.awaiting.length} sale{st.awaiting.length === 1 ? "" : "s"} delivered in this period, worth {formatTaka(st.awaiting.reduce((t, x) => t + x.revenue, 0))}, {st.awaiting.length === 1 ? "has its" : "have their"} cash not collected yet — not money in hand, so not listed below:{" "}
          {st.awaiting.slice(0, 12).map((x, i) => (
            <span key={x.key}>
              {i > 0 && ", "}
              <Link href={x.href} prefetch={false} className="underline">
                {x.ref}
              </Link>
            </span>
          ))}
          {st.awaiting.length > 12 && ` … and ${st.awaiting.length - 12} more`}. Mark them collected under{" "}
          <Link href="/admin/finance/sales?status=awaiting_cash&range=all" className="underline">
            Sales
          </Link>
          .
        </p>
      )}

      <form method="get" className="mb-3.5 flex flex-wrap items-end gap-2.5 print:hidden">
        {range.preset === "custom" ? (
          <>
            {range.from && <input type="hidden" name="from" value={range.from} />}
            {range.to && <input type="hidden" name="to" value={range.to} />}
          </>
        ) : (
          range.preset !== "this-month" && <input type="hidden" name="range" value={range.preset} />
        )}
        <select name="type" defaultValue={type} aria-label="What to list" className="border border-line-2 bg-panel px-2.5 py-2 text-sm">
          {Object.entries(TYPE_FILTERS).map(([v, f]) => (
            <option key={v} value={v}>
              {f.label}
            </option>
          ))}
        </select>
        <input type="search" name="q" defaultValue={q} placeholder="Search customer, vendor, category, product…" className="w-full max-w-[340px] border border-line-2 bg-panel px-3 py-2 text-sm outline-none focus:border-lime" />
        <button type="submit" className="border border-line-2 px-3.5 py-2 text-sm hover:border-lime">
          Filter
        </button>
        <span className="text-[13px] text-muted">
          {st.lines.length} {st.lines.length === 1 ? "transaction" : "transactions"} listed
        </span>
      </form>

      <Panel className="!p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="border-b border-line-2 text-left text-muted">
                {["Date", "Type", "Details", "Party", "Owner", "Method", "In", "Out", "Balance"].map((h, i) => (
                  <th key={h} className={`font-label px-3 py-2.5 text-[13px] tracking-[0.8px] ${i >= 6 ? "text-right" : ""}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-line text-muted">
                <td colSpan={8} className="px-3 py-2.5 italic">
                  Opening balance
                </td>
                <td className="px-3 py-2.5 text-right">
                  <Money value={st.opening} tone="plain" />
                </td>
              </tr>
              {st.lines.map((l) => (
                <tr key={l.key} className="border-b border-line align-top">
                  <td className="whitespace-nowrap px-3 py-2.5">{formatDayOf(l.date)}</td>
                  <td className="px-3 py-2.5">
                    <KindChip kind={l.kind} label={KIND_LABEL[l.kind]} />
                  </td>
                  <td className="px-3 py-2.5">
                    {l.kind === "SALE" ? (
                      <Link href={l.href} prefetch={false} className="text-cyan hover:underline">
                        {l.title}
                      </Link>
                    ) : (
                      l.title
                    )}
                    <div className="text-[12px] text-muted-2">{l.category}</div>
                  </td>
                  <td className="px-3 py-2.5 text-muted">{l.party || "—"}</td>
                  <td className="px-3 py-2.5 text-muted">{l.owner || "—"}</td>
                  <td className="px-3 py-2.5 text-muted">{l.method || "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right">{l.inAmount > 0 ? <Money value={l.inAmount} tone="in" /> : ""}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right">{l.outAmount > 0 ? <Money value={l.outAmount} tone="out" /> : ""}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right">
                    <Money value={l.balance} tone="plain" />
                  </td>
                </tr>
              ))}
              {st.lines.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-muted">
                    Nothing recorded in this period.
                  </td>
                </tr>
              )}
              <tr className="border-t border-line-2 font-medium">
                <td colSpan={6} className="px-3 py-3">
                  Totals listed
                </td>
                <td className="px-3 py-3 text-right">
                  <Money value={listedIn} tone="in" />
                </td>
                <td className="px-3 py-3 text-right">
                  <Money value={listedOut} tone="out" />
                </td>
                <td className="px-3 py-3 text-right">
                  <Money value={st.closing} tone="plain" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Panel>
      <p className="mt-3 text-[12px] text-muted-2">
        The balance counts every transaction, whatever is filtered. A sale appears here on the day its cash was collected (marked on the order, or under Sales); sales delivered but not collected yet, orders still in progress, and cancelled or refunded orders do not move money and are not listed.
      </p>
    </div>
  );
}
