import { requireAdminPage } from "@/lib/admin-guard";
import { StatementDocument } from "@/components/admin/finance/StatementDocument";
import { StatementToolbar } from "@/components/admin/PrintButton";
import { loadFinance } from "@/lib/finance";
import { rangeQuery, resolveRange } from "@/lib/finance-dates";
import { buildStatement, STATEMENT_VIEWS, type StatementView } from "@/lib/statement";
import { getStoreInfo } from "@/lib/store-settings";

type Props = { searchParams: Promise<{ range?: string; from?: string; to?: string; view?: string }> };

/** The statement on its own, for printing or saving as a PDF (A4). Same figures as the preview — both are drawn from buildStatement. */
export default async function PrintableStatementPage({ searchParams }: Props) {
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
  return (
    <div className="min-h-screen bg-paper px-5 py-10 text-ink print:min-h-0 print:bg-white print:p-0">
      <StatementToolbar backHref={`/admin/finance/statement${rangeQuery(range, { view: view === "full" ? undefined : view })}`} />
      <StatementDocument m={model} />
    </div>
  );
}
