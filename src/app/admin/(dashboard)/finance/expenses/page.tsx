import { requireAdminPage } from "@/lib/admin-guard";
import { db } from "@/lib/db";
import { toNumber } from "@/lib/money";
import { Kpi } from "@/components/admin/Kpi";
import { RangeBar } from "@/components/admin/finance/RangeBar";
import { ExpensesManager, type ExpenseRow } from "@/components/admin/finance/ExpensesManager";
import { EXPENSE_CATEGORIES } from "@/lib/finance";
import { dayAfter, dayStart, dhakaDay, resolveRange, todayDhaka } from "@/lib/finance-dates";
import { formatTaka } from "@/lib/money";

type Props = { searchParams: Promise<{ range?: string; from?: string; to?: string; category?: string; q?: string }> };

export default async function FinanceExpensesPage({ searchParams }: Props) {
  await requireAdminPage("finance");
  const sp = await searchParams;
  const range = resolveRange(sp);
  const category = sp.category?.trim() || "";
  const q = sp.q?.trim() || "";

  const date = { ...(range.from ? { gte: dayStart(range.from) } : {}), ...(range.to ? { lt: dayAfter(range.to) } : {}) };
  const [rowsRaw, used] = await Promise.all([
    db.expense.findMany({
      where: {
        date,
        ...(category ? { category } : {}),
        ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { paidTo: { contains: q, mode: "insensitive" } }, { notes: { contains: q, mode: "insensitive" } }, { category: { contains: q, mode: "insensitive" } }] } : {}),
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
    db.expense.findMany({ distinct: ["category"], select: { category: true } }),
  ]);
  const categories = [...new Set([...EXPENSE_CATEGORIES, ...used.map((u) => u.category)])].sort((a, b) => a.localeCompare(b));
  const rows: ExpenseRow[] = rowsRaw.map((e) => ({ id: e.id, date: dhakaDay(e.date), amount: toNumber(e.amount), category: e.category, title: e.title, paidTo: e.paidTo ?? "", method: e.method, notes: e.notes ?? "" }));
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const byCat = new Map<string, number>();
  for (const r of rows) byCat.set(r.category, (byCat.get(r.category) ?? 0) + r.amount);
  const top = [...byCat.entries()].sort((a, b) => b[1] - a[1])[0];

  return (
    <div>
      <RangeBar basePath="/admin/finance/expenses" range={range} keep={{ category: category || undefined, q: q || undefined }} />
      <div className="mb-4.5 grid grid-cols-2 gap-4 desktop:grid-cols-4">
        <Kpi label="Expenses" value={formatTaka(total)} accent="pink" delta={`${rows.length} entries · ${range.label}`} />
        <Kpi label="Biggest category" value={top ? top[0] : "—"} accent="yellow" delta={top ? formatTaka(top[1]) : undefined} />
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
        <select name="category" defaultValue={category} aria-label="Category" className="border border-line-2 bg-panel px-2.5 py-2 text-sm">
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input type="search" name="q" defaultValue={q} placeholder="Search description, vendor, notes…" className="w-full max-w-[340px] border border-line-2 bg-panel px-3 py-2 text-sm outline-none focus:border-lime" />
        <button type="submit" className="border border-line-2 px-3.5 py-2 text-sm hover:border-lime">
          Filter
        </button>
      </form>

      <ExpensesManager rows={rows} categories={categories} today={todayDhaka()} total={total} />
    </div>
  );
}
