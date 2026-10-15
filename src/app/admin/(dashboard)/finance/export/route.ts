import { NextRequest, NextResponse } from "next/server";
import { getAdminForArea } from "@/lib/admin-guard";
import { KIND_LABEL, loadFinance, statement, toCsv, type TxnKind } from "@/lib/finance";
import { dhakaDay, resolveRange } from "@/lib/finance-dates";

const KINDS: Record<string, TxnKind[] | undefined> = { sales: ["SALE"], expenses: ["EXPENSE"], investments: ["INVESTMENT"], stock: ["STOCK_PURCHASE"] };

/** The statement for a period as a spreadsheet — same filters as the Statement page. */
export async function GET(req: NextRequest) {
  if (!(await getAdminForArea("finance"))) return new NextResponse("Not authorized.", { status: 403 });
  const sp = req.nextUrl.searchParams;
  const range = resolveRange({ range: sp.get("range") ?? undefined, from: sp.get("from") ?? undefined, to: sp.get("to") ?? undefined });
  const data = await loadFinance();
  const st = statement(data, range, { kinds: KINDS[sp.get("type") ?? ""], q: sp.get("q") ?? undefined });

  const rows: (string | number)[][] = [["Date", "Type", "Details", "Category", "Party", "Method", "Money in", "Money out", "Balance"]];
  rows.push(["", "", "Opening balance", "", "", "", "", "", st.opening]);
  for (const l of st.lines) rows.push([dhakaDay(l.date), KIND_LABEL[l.kind], l.title, l.category, l.party, l.method, l.inAmount || "", l.outAmount || "", l.balance]);
  rows.push(["", "", "Closing balance", "", "", "", st.moneyIn, st.moneyOut, st.closing]);

  const name = `statement-${range.from ?? "start"}_to_${range.to ?? "today"}.csv`;
  return new NextResponse(toCsv(rows), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" },
  });
}
