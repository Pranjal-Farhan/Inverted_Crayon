import { requireAdminPage } from "@/lib/admin-guard";
import { db } from "@/lib/db";
import { toNumber, formatTaka } from "@/lib/money";
import { Kpi } from "@/components/admin/Kpi";
import { RangeBar } from "@/components/admin/finance/RangeBar";
import { ExpensesManager, type ExpenseRow } from "@/components/admin/finance/ExpensesManager";
import { ExpenseCategoriesBox } from "@/components/admin/finance/ExpenseCategoriesBox";
import { OwnersPanel } from "@/components/admin/finance/OwnersPanel";
import { dayAfter, dayStart, dhakaDay, resolveRange, todayDhaka } from "@/lib/finance-dates";

type Props = { searchParams: Promise<{ range?: string; from?: string; to?: string; category?: string; owner?: string; q?: string }> };

export default async function FinanceExpensesPage({ searchParams }: Props) {
  await requireAdminPage("finance");
  const sp = await searchParams;
  const range = resolveRange(sp);
  const category = sp.category?.trim() || "";
  const ownerFilter = sp.owner?.trim() || "";
  const q = sp.q?.trim() || "";

  const date = { ...(range.from ? { gte: dayStart(range.from) } : {}), ...(range.to ? { lt: dayAfter(range.to) } : {}) };
  const [rowsRaw, categories, owners] = await Promise.all([
    db.expense.findMany({
      where: {
        date,
        ...(category ? { categoryId: category } : {}),
        ...(ownerFilter === "none" ? { ownerId: null } : ownerFilter ? { ownerId: ownerFilter } : {}),
        ...(q
          ? {
              OR: [
                { owner: { name: { contains: q, mode: "insensitive" as const } } },
                { title: { contains: q, mode: "insensitive" as const } },
                { paidTo: { contains: q, mode: "insensitive" as const } },
                { notes: { contains: q, mode: "insensitive" as const } },
                { category: { name: { contains: q, mode: "insensitive" as const } } },
              ],
            }
          : {}),
      },
      include: { owner: { select: { name: true } }, category: { select: { name: true } } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
    db.expenseCategory.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { expenses: true } } } }),
    db.stockOwner.findMany({ orderBy: { createdAt: "asc" }, include: { _count: { select: { expenses: true } } } }),
  ]);

  const rows: ExpenseRow[] = rowsRaw.map((e) => ({
    id: e.id,
    date: dhakaDay(e.date),
    amount: toNumber(e.amount),
    categoryId: e.categoryId,
    category: e.category.name,
    title: e.title,
    paidTo: e.paidTo ?? "",
    method: e.method,
    ownerId: e.ownerId ?? "",
    ownerName: e.owner?.name ?? "",
    notes: e.notes ?? "",
    createdBy: e.createdByEmail ?? "",
  }));
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const byCat = new Map<string, number>();
  for (const r of rows) byCat.set(r.category, (byCat.get(r.category) ?? 0) + r.amount);
  const top = [...byCat.entries()].sort((a, b) => b[1] - a[1])[0];

  return (
    <div>
      <div className="mb-1 grid grid-cols-1 gap-4.5 desktop:grid-cols-[1fr_340px] desktop:items-start">
        <div>
          <RangeBar basePath="/admin/finance/expenses" range={range} keep={{ category: category || undefined, owner: ownerFilter || undefined, q: q || undefined }} />
          <div className="mb-4.5 grid grid-cols-2 gap-4">
            <Kpi label="Expenses" value={formatTaka(total)} accent="pink" delta={`${rows.length} ${rows.length === 1 ? "entry" : "entries"} · ${range.label}`} />
            <Kpi label="Biggest category" value={top ? top[0] : "—"} accent="yellow" delta={top ? formatTaka(top[1]) : undefined} />
          </div>
        </div>
        <ExpenseCategoriesBox categories={categories.map((c) => ({ id: c.id, name: c.name, count: c._count.expenses }))} />
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
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select name="owner" defaultValue={ownerFilter} aria-label="Owner" className="border border-line-2 bg-panel px-2.5 py-2 text-sm">
          <option value="">All owners</option>
          {owners.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
          <option value="none">Owner not recorded</option>
        </select>
        <input type="search" name="q" defaultValue={q} placeholder="Search description, vendor, owner, category, notes…" className="w-full max-w-[360px] border border-line-2 bg-panel px-3 py-2 text-sm outline-none focus:border-lime" />
        <button type="submit" className="border border-line-2 px-3.5 py-2 text-sm hover:border-lime">
          Filter
        </button>
      </form>

      <OwnersPanel owners={owners.map((o) => ({ id: o.id, name: o.name, contact: o.contact ?? "", notes: o.notes ?? "", expenseCount: o._count.expenses }))} />

      <ExpensesManager
        rows={rows}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        owners={owners.map((o) => ({ id: o.id, name: o.name }))}
        today={todayDhaka()}
        total={total}
      />
    </div>
  );
}
