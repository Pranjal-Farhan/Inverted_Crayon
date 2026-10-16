import { requireAdminPage } from "@/lib/admin-guard";
import { db } from "@/lib/db";
import { toNumber, formatTaka } from "@/lib/money";
import { Kpi } from "@/components/admin/Kpi";
import { RangeBar } from "@/components/admin/finance/RangeBar";
import { InvestmentsManager, type InvestmentRow, type OwnerRow } from "@/components/admin/finance/InvestmentsManager";
import { loadFinance, ownerSummary } from "@/lib/finance";
import { dayAfter, dayStart, dhakaDay, resolveRange, todayDhaka } from "@/lib/finance-dates";

type Props = { searchParams: Promise<{ range?: string; from?: string; to?: string }> };

export default async function FinanceInvestmentsPage({ searchParams }: Props) {
  await requireAdminPage("finance");
  const range = resolveRange(await searchParams);
  const date = { ...(range.from ? { gte: dayStart(range.from) } : {}), ...(range.to ? { lt: dayAfter(range.to) } : {}) };
  const [rowsRaw, data] = await Promise.all([
    db.investment.findMany({ where: { date }, include: { owner: true }, orderBy: [{ date: "desc" }, { createdAt: "desc" }] }),
    loadFinance(),
  ]);
  const owners = ownerSummary(data);
  const rows: InvestmentRow[] = rowsRaw.map((i) => ({ id: i.id, date: dhakaDay(i.date), amount: toNumber(i.amount), ownerId: i.ownerId, ownerName: i.owner.name, description: i.description ?? "", method: i.method, notes: i.notes ?? "" }));
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const ownerRows: OwnerRow[] = owners.rows.map((o) => ({ id: o.id, name: o.name, contact: o.contact ?? "", notes: o.notes ?? "", invested: o.invested, stockPaid: o.stockPaid, expensesPaid: o.expensesPaid }));

  return (
    <div>
      <RangeBar basePath="/admin/finance/investments" range={range} />
      <div className="mb-4.5 grid grid-cols-2 gap-4 desktop:grid-cols-4">
        <Kpi label="Invested (period)" value={formatTaka(total)} accent="cyan" delta={`${rows.length} entries · ${range.label}`} />
        <Kpi label="Invested (all time)" value={formatTaka(owners.totalInvested)} accent="lime" />
      </div>
      <InvestmentsManager rows={rows} owners={ownerRows} today={todayDhaka()} total={total} />
    </div>
  );
}
