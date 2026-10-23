import { NextRequest, NextResponse } from "next/server";
import { getAdminForArea } from "@/lib/admin-guard";
import { loadFinance, toCsv } from "@/lib/finance";
import { dhakaDay, formatDay, resolveRange } from "@/lib/finance-dates";
import { buildStatement, STATEMENT_VIEWS, type StatementView } from "@/lib/statement";
import { getStoreInfo } from "@/lib/store-settings";

/** The statement for a period as a spreadsheet — the same model as the Statement page and its printable view. */
export async function GET(req: NextRequest) {
  const admin = await getAdminForArea("finance");
  if (!admin) return new NextResponse("Not authorized.", { status: 403 });
  try {
    const sp = req.nextUrl.searchParams;
    const range = resolveRange({ range: sp.get("range") ?? undefined, from: sp.get("from") ?? undefined, to: sp.get("to") ?? undefined });
    const view = (STATEMENT_VIEWS.some((v) => v.id === sp.get("view")) ? sp.get("view") : "full") as StatementView;
    const [data, store] = await Promise.all([loadFinance(), getStoreInfo()]);
    const m = buildStatement(data, range, {
      store,
      view,
      preparedBy: { name: admin.name, email: admin.email, role: admin.role === "ADMIN" ? "Administrator" : "Staff" },
    });
    const s = m.summary;
    const period = range.from && range.to ? `${formatDay(range.from)} to ${formatDay(range.to)}` : range.label;

    const rows: (string | number)[][] = [
      [store.name, "Statement of Income & Expenses"],
      ["Statement no.", m.number],
      ["Period", period],
      ["Date issued", dhakaDay(m.generatedAt)],
      ["Currency", "BDT"],
      [],
      ["Profit & loss", "Amount"],
      ["Products sold, after discounts", s.itemsRevenue],
      ["Delivery charged", s.delivery],
      ["Total Sales", s.revenue],
      ["Buying Cost", -s.buyingCost],
      ...s.expensesByCategory.map((c): (string | number)[] => [`Expenses — ${c.category}`, -c.amount]),
      ["Total Expenses", -s.expenses],
      [s.profit >= 0 ? "Profit" : "Loss", s.profit],
    ];
    if (m.view === "full" || m.view === "sales") {
      rows.push([], ["Sales"], ["Date", "Order no.", "Source", "Customer", "Products", "Total sales", "Buying cost", "Profit"]);
      for (const r of m.sales) {
        rows.push([
          dhakaDay(r.date),
          r.ref,
          r.source === "ONLINE" ? "Online" : "Recorded",
          r.customerName,
          r.lines.map((l) => `${l.qty} x ${l.title}${l.variant ? ` (${l.variant})` : ""}${l.sku ? ` [${l.sku}]` : ""}`).join("; "),
          r.revenue,
          r.cogs,
          r.profit,
        ]);
      }
    }
    if (m.view === "full" || m.view === "expenses") {
      rows.push([], ["Expenses"], ["Date", "Category", "Description", "Paid to", "Paid by", "Method", "Amount", "Notes"]);
      for (const e of m.expenses) rows.push([dhakaDay(e.date), e.category, e.title, e.paidTo, e.ownerName, e.method, e.amount, e.notes]);
    }

    const name = `statement-${range.from ?? "start"}_to_${range.to ?? "today"}.csv`;
    return new NextResponse(toCsv(rows), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" },
    });
  } catch (e) {
    console.error("[finance/export]", e);
    return new NextResponse("The statement couldn't be generated. Please try again.", { status: 500 });
  }
}
