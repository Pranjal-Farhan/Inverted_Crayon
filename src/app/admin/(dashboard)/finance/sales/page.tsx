import { requireAdminPage } from "@/lib/admin-guard";
import { db } from "@/lib/db";
import { toNumber } from "@/lib/money";
import { Kpi } from "@/components/admin/Kpi";
import { RangeBar } from "@/components/admin/finance/RangeBar";
import { SalesManager, type ManualSaleInitial, type SaleListRow, type VariantOption } from "@/components/admin/finance/SalesManager";
import { loadFinance } from "@/lib/finance";
import { dhakaDay, formatDayOf, inRange, resolveRange, todayDhaka } from "@/lib/finance-dates";
import { formatTaka } from "@/lib/money";

type Props = { searchParams: Promise<{ range?: string; from?: string; to?: string; source?: string; status?: string; q?: string }> };

const SOURCES = [["all", "All sales"], ["online", "Online orders"], ["manual", "Manual sales"]] as const;
const STATUSES = [
  ["all", "Any status"],
  ["completed", "Completed (counted)"],
  ["cash_collected", "Cash collected"],
  ["awaiting_cash", "Delivered — awaiting cash"],
  ["in_progress", "In progress"],
  ["unpaid", "Awaiting payment (manual)"],
  ["lost", "Cancelled / refunded"],
  ["removed", "Removed from finance"],
] as const;

export default async function FinanceSalesPage({ searchParams }: Props) {
  await requireAdminPage("finance");
  const sp = await searchParams;
  const range = resolveRange(sp);
  const source = SOURCES.some(([v]) => v === sp.source) ? sp.source! : "all";
  const status = STATUSES.some(([v]) => v === sp.status) ? sp.status! : "all";
  const q = sp.q?.trim() ?? "";

  const [data, variants] = await Promise.all([
    loadFinance(),
    db.variant.findMany({ include: { product: { select: { title: true, basePrice: true } } }, orderBy: [{ product: { title: "asc" } }, { size: "asc" }] }),
  ]);

  const needle = q.toLowerCase();
  // "Removed from finance" lists only those; every other view leaves them out.
  const pool = status === "removed" ? data.removed : data.sales;
  const rows = pool.filter(
    (s) =>
      inRange(s.date, range) &&
      (source === "all" || (source === "online" ? s.source === "ORDER" : s.source === "MANUAL")) &&
      (status === "all" || status === "removed" ||
        (status === "cash_collected" ? s.cashStatus === "COLLECTED" : status === "awaiting_cash" ? s.cashStatus === "AWAITING" : s.status === status.toUpperCase())) &&
      (!needle || [s.ref, s.customerName, s.customerPhone, s.customerEmail, s.itemsSummary].join(" ").toLowerCase().includes(needle)),
  );

  const count = (st: string) => rows.filter((r) => r.status === st);
  const sum = (list: typeof rows, f: (r: (typeof rows)[number]) => number) => list.reduce((s, r) => s + f(r), 0);
  const done = count("COMPLETED");
  const collected = rows.filter((r) => r.cashStatus === "COLLECTED" && r.status !== "LOST");
  const awaiting = rows.filter((r) => r.cashStatus === "AWAITING");

  const listRows: SaleListRow[] = rows.map((r) => ({
    key: r.key,
    source: r.source,
    id: r.id,
    ref: r.ref,
    href: r.href,
    date: dhakaDay(r.date),
    customerName: r.customerName,
    customerPhone: r.customerPhone,
    itemsSummary: r.itemsSummary,
    status: r.status,
    statusLabel: r.statusLabel,
    paymentLabel: r.paymentLabel,
    revenue: r.revenue,
    cogs: r.cogs,
    profit: r.profit,
    unknownCostUnits: r.unknownCostUnits,
    cashStatus: r.cashStatus,
    cashOn: r.cashAt ? formatDayOf(r.cashAt) : "",
    canUndoCash: r.cashMarked,
    removed: status === "removed",
  }));

  const manual: Record<string, ManualSaleInitial> = {};
  for (const m of data.manualSales) {
    manual[m.id] = {
      id: m.id,
      number: m.number,
      date: dhakaDay(m.date),
      customerName: m.customerName,
      customerPhone: m.customerPhone ?? "",
      customerEmail: m.customerEmail ?? "",
      customerAddress: m.customerAddress ?? "",
      method: m.method,
      paid: m.paid,
      discount: toNumber(m.discount),
      deliveryCharge: toNumber(m.deliveryCharge),
      notes: m.notes ?? "",
      items: m.items.map((i) => ({ description: i.description, variantId: i.variantId, qty: i.qty, unitPrice: toNumber(i.unitPrice), unitCost: i.unitCost != null ? String(toNumber(i.unitCost)) : "", deduct: i.stockDeducted })),
    };
  }

  const variantOptions: VariantOption[] = variants.map((v) => ({
    id: v.id,
    label: `${v.product.title} — ${v.size}/${v.color}`,
    sku: v.sku,
    price: toNumber(v.product.basePrice),
    cost: data.unitCostOf({ productId: v.productId, variantId: v.id }),
    stock: v.stockQty,
  }));

  return (
    <div>
      <RangeBar basePath="/admin/finance/sales" range={range} keep={{ source: source === "all" ? undefined : source, status: status === "all" ? undefined : status, q: q || undefined }} />

      <div className="mb-4.5 grid grid-cols-2 gap-4 desktop:grid-cols-3">
        <Kpi label="Completed sales" value={formatTaka(sum(done, (r) => r.revenue))} accent="lime" delta={`${done.length} sales · profit ${formatTaka(sum(done, (r) => r.profit))}`} />
        <Kpi label="Cash collected" value={formatTaka(sum(collected, (r) => r.revenue))} accent="cyan" delta={`${collected.length} sales`} />
        <Kpi label="Delivered — awaiting cash" value={formatTaka(sum(awaiting, (r) => r.revenue))} accent="yellow" delta={`${awaiting.length} orders · mark them collected below`} />
        <Kpi label="In progress" value={formatTaka(sum(count("IN_PROGRESS"), (r) => r.revenue))} accent="cyan" delta={`${count("IN_PROGRESS").length} online orders`} />
        <Kpi label="Awaiting payment" value={formatTaka(sum(count("UNPAID"), (r) => r.revenue))} accent="yellow" delta={`${count("UNPAID").length} manual sales`} />
        <Kpi label="Cancelled / refunded" value={formatTaka(sum(count("LOST"), (r) => r.revenue))} accent="pink" delta={`${count("LOST").length} orders`} />
      </div>

      <form method="get" className="mb-4 flex flex-wrap items-end gap-2.5">
        {range.preset === "custom" ? (
          <>
            {range.from && <input type="hidden" name="from" value={range.from} />}
            {range.to && <input type="hidden" name="to" value={range.to} />}
          </>
        ) : (
          range.preset !== "this-month" && <input type="hidden" name="range" value={range.preset} />
        )}
        <select name="source" defaultValue={source} aria-label="Source" className="border border-line-2 bg-panel px-2.5 py-2 text-sm">
          {SOURCES.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={status} aria-label="Status" className="border border-line-2 bg-panel px-2.5 py-2 text-sm">
          {STATUSES.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <input type="search" name="q" defaultValue={q} placeholder="Search customer, order #, phone, product…" className="w-full max-w-[340px] border border-line-2 bg-panel px-3 py-2 text-sm outline-none focus:border-lime" />
        <button type="submit" className="border border-line-2 px-3.5 py-2 text-sm hover:border-lime">
          Filter
        </button>
      </form>

      <p className="mb-3 text-[13px] text-muted">
        Every order from the website is listed automatically and counts as a sale once it&apos;s delivered (or paid online); its cash counts once you mark it collected. Sales made elsewhere — Instagram, in person — are recorded with the form above. Tick rows to delete or remove several at once.
        {range.label ? ` Showing ${range.label.toLowerCase() === "all time" ? "all time" : range.label}.` : ""}
      </p>

      <SalesManager rows={listRows} manual={manual} variants={variantOptions} today={todayDhaka()} />
    </div>
  );
}
