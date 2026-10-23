import Link from "next/link";
import { requireAdminPage } from "@/lib/admin-guard";
import { RangeBar } from "@/components/admin/finance/RangeBar";
import { StatementDocument } from "@/components/admin/finance/StatementDocument";
import { loadFinance } from "@/lib/finance";
import { rangeQuery, resolveRange } from "@/lib/finance-dates";
import { buildStatement, STATEMENT_VIEWS, type StatementView } from "@/lib/statement";
import { getStoreInfo } from "@/lib/store-settings";

type Props = { searchParams: Promise<{ range?: string; from?: string; to?: string; view?: string }> };

/**
 * The Statement: a formal statement of income & expenses for the chosen period, shown as the document
 * it will print as. "Open printable statement" is the A4 print / PDF view; "Download CSV" is the same
 * figures as a spreadsheet.
 */
export default async function FinanceStatementPage({ searchParams }: Props) {
  const admin = await requireAdminPage("finance");
  const sp = await searchParams;
  const range = resolveRange(sp);
  const view = (STATEMENT_VIEWS.some((v) => v.id === sp.view) ? sp.view : "full") as StatementView;
  const [data, store] = await Promise.all([loadFinance(), getStoreInfo()]);
  const model = buildStatement(data, range, {
    store,
    view,
    preparedBy: { name: admin.name, email: admin.email, role: admin.role === "ADMIN" ? "Administrator" : "Staff" },
  });
  const viewQuery = view === "full" ? undefined : view;
  const printHref = `/admin/finance/statement/print${rangeQuery(range, { view: viewQuery })}`;
  const csvHref = `/admin/finance/export${rangeQuery(range, { view: viewQuery })}`;

  return (
    <div>
      <RangeBar basePath="/admin/finance/statement" range={range} keep={{ view: viewQuery }} />

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <form method="get" className="flex flex-wrap items-end gap-2.5">
          {range.preset === "custom" ? (
            <>
              {range.from && <input type="hidden" name="from" value={range.from} />}
              {range.to && <input type="hidden" name="to" value={range.to} />}
            </>
          ) : (
            range.preset !== "this-month" && <input type="hidden" name="range" value={range.preset} />
          )}
          <label className="block">
            <span className="font-label mb-1 block text-[12px] tracking-[1px] text-muted">CONTENTS</span>
            <select name="view" defaultValue={view} className="border border-line-2 bg-panel px-2.5 py-2 text-sm">
              {STATEMENT_VIEWS.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="border border-line-2 px-3.5 py-2 text-sm hover:border-lime">
            Apply
          </button>
        </form>
        <div className="flex flex-wrap gap-2">
          <Link href={printHref} target="_blank" prefetch={false} className="btn-primary bg-lime px-4 py-2 font-impact text-sm text-ink">
            Open printable statement / PDF →
          </Link>
          <a href={csvHref} className="border border-line-2 px-4 py-2 text-sm hover:border-lime">
            Download CSV
          </a>
        </div>
      </div>

      <p className="mb-4 text-[13px] text-muted">
        This is the statement exactly as it prints: open it in its own tab and choose <strong>Print → Save as PDF</strong>. Sales are counted once delivered (or paid in advance); the Buying Cost, Expenses and Profit follow the same rules as the Overview.
      </p>

      <div className="overflow-x-auto bg-[#e9e9e9] p-3 desktop:p-6">
        <StatementDocument m={model} />
      </div>
    </div>
  );
}
