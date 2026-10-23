import { requireAdminPage } from "@/lib/admin-guard";
import { Kpi } from "@/components/admin/Kpi";
import { RangeBar } from "@/components/admin/finance/RangeBar";
import { SalesManager, type SaleListRow } from "@/components/admin/finance/SalesManager";
import { loadFinance, SALE_STATUSES, type SaleRow } from "@/lib/finance";
import { loadVariantOptions } from "@/lib/variant-options";
import { dhakaDay, inRange, resolveRange, todayDhaka } from "@/lib/finance-dates";
import { formatTaka, formatTakaSigned } from "@/lib/money";

type Props = { searchParams: Promise<{ range?: string; from?: string; to?: string; source?: string; status?: string; q?: string }> };

const SOURCES = [
  ["all", "All sales"],
  ["online", "Online orders"],
  ["recorded", "Recorded sales"],
] as const;

export default async function FinanceSalesPage({ searchParams }: Props) {
  await requireAdminPage("finance");
  const sp = await searchParams;
  const range = resolveRange(sp);
  const source = SOURCES.some(([v]) => v === sp.source) ? sp.source! : "all";
  const statusKeys = SALE_STATUSES.map((s) => s.key as string);
  const status = sp.status === "removed" || statusKeys.includes(sp.status ?? "") ? sp.status! : "all";
  const q = sp.q?.trim() ?? "";

  const [data, variants] = await Promise.all([loadFinance(), loadVariantOptions({ includeCost: false })]);

  const needle = q.toLowerCase();
  // "Removed from finance" lists only those; every other view leaves them out.
  const pool = status === "removed" ? data.removed : data.sales;
  const matches = (s: SaleRow) =>
    inRange(s.date, range) &&
    (source === "all" || (source === "online" ? s.source === "ONLINE" : s.source === "RECORDED")) &&
    (!needle ||
      [s.ref, s.customerName, s.customerPhone, s.customerEmail, ...s.lines.flatMap((l) => [l.title, l.variant, l.sku])]
        .join(" ")
        .toLowerCase()
        .includes(needle));
  // Everything except the status filter — the status strip counts against this, so it shows what each status would list.
  const inScope = pool.filter(matches);
  const rows = status === "all" || status === "removed" ? inScope : inScope.filter((s) => s.status === status);

  const counted = rows.filter((r) => r.counted);
  const sum = (list: SaleRow[], f: (r: SaleRow) => number) => list.reduce((s, r) => s + f(r), 0);
  const revenue = sum(counted, (r) => r.revenue);
  const buying = sum(counted, (r) => r.cogs);

  const listRows: SaleListRow[] = rows.map((r) => ({
    key: r.key,
    source: r.source,
    id: r.id,
    ref: r.ref,
    href: r.href,
    date: dhakaDay(r.date),
    customerName: r.customerName,
    customerPhone: r.customerPhone,
    lines: r.lines,
    status: r.status,
    statusLabel: r.statusLabel,
    counted: r.counted,
    paymentLabel: r.paymentLabel,
    revenue: r.revenue,
    cogs: r.cogs,
    profit: r.profit,
    unknownCostUnits: r.unknownCostUnits,
    removed: status === "removed",
  }));

  const chipHref = (key: string) => {
    const p = new URLSearchParams();
    if (range.preset === "custom") {
      if (range.from) p.set("from", range.from);
      if (range.to) p.set("to", range.to);
    } else if (range.preset !== "this-month") p.set("range", range.preset);
    if (source !== "all") p.set("source", source);
    if (q) p.set("q", q);
    if (key !== "all") p.set("status", key);
    const s = p.toString();
    return `/admin/finance/sales${s ? `?${s}` : ""}`;
  };

  return (
    <div>
      <RangeBar basePath="/admin/finance/sales" range={range} keep={{ source: source === "all" ? undefined : source, status: status === "all" ? undefined : status, q: q || undefined }} />

      <div className="mb-4 grid grid-cols-2 gap-4 desktop:grid-cols-3">
        <Kpi label="Total Sales" value={formatTaka(revenue)} accent="cyan" delta={`${counted.length} counted ${counted.length === 1 ? "sale" : "sales"} in this list`} />
        <Kpi label="Buying Cost" value={formatTaka(buying)} accent="yellow" />
        <Kpi label="Profit" value={formatTakaSigned(revenue - buying)} accent={revenue - buying >= 0 ? "lime" : "pink"} delta="before expenses" />
      </div>

      <nav className="mb-4 flex flex-wrap gap-2" aria-label="Filter by order status">
        <a href={chipHref("all")} className={`border px-3 py-1.5 text-[13px] ${status === "all" ? "border-lime text-lime" : "border-line-2 text-muted hover:border-lime"}`}>
          All statuses <span className="text-muted-2">· {inScope.length}</span>
        </a>
        {SALE_STATUSES.map((s) => {
          const list = inScope.filter((r) => r.status === s.key);
          return (
            <a key={s.key} href={chipHref(s.key)} className={`border px-3 py-1.5 text-[13px] ${status === s.key ? "border-lime text-lime" : "border-line-2 text-muted hover:border-lime"}`}>
              {s.label} <span className="text-muted-2">· {list.length}</span>
            </a>
          );
        })}
        <a href={chipHref("removed")} className={`border px-3 py-1.5 text-[13px] ${status === "removed" ? "border-lime text-lime" : "border-line-2 text-muted hover:border-lime"}`}>
          Removed from finance
        </a>
      </nav>

      <form method="get" className="mb-4 flex flex-wrap items-end gap-2.5">
        {range.preset === "custom" ? (
          <>
            {range.from && <input type="hidden" name="from" value={range.from} />}
            {range.to && <input type="hidden" name="to" value={range.to} />}
          </>
        ) : (
          range.preset !== "this-month" && <input type="hidden" name="range" value={range.preset} />
        )}
        {status !== "all" && <input type="hidden" name="status" value={status} />}
        <select name="source" defaultValue={source} aria-label="Source" className="border border-line-2 bg-panel px-2.5 py-2 text-sm">
          {SOURCES.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <input type="search" name="q" defaultValue={q} placeholder="Search customer, order #, phone, product, SKU…" className="w-full max-w-[360px] border border-line-2 bg-panel px-3 py-2 text-sm outline-none focus:border-lime" />
        <button type="submit" className="border border-line-2 px-3.5 py-2 text-sm hover:border-lime">
          Filter
        </button>
      </form>

      <p className="mb-3 text-[13px] text-muted">
        Every order from the website is listed automatically, and so is every sale you record here. Click any row to open that order with its full details. A sale counts in Total Sales once it is <strong>Delivered</strong> (or paid in advance).
        {range.label ? ` Showing ${range.label.toLowerCase() === "all time" ? "all time" : range.label}.` : ""}
      </p>

      <SalesManager rows={listRows} variants={variants} today={todayDhaka()} />
    </div>
  );
}
