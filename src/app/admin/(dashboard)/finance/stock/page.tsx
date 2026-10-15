import { requireAdminPage } from "@/lib/admin-guard";
import { db } from "@/lib/db";
import { toNumber, formatTaka } from "@/lib/money";
import { Kpi } from "@/components/admin/Kpi";
import { Panel } from "@/components/admin/Panel";
import { RangeBar } from "@/components/admin/finance/RangeBar";
import { StockManager, type PurchaseRow } from "@/components/admin/finance/StockManager";
import { dayAfter, dayStart, dhakaDay, resolveRange } from "@/lib/finance-dates";

type Props = { searchParams: Promise<{ range?: string; from?: string; to?: string }> };

export default async function FinanceStockPage({ searchParams }: Props) {
  await requireAdminPage("finance");
  const range = resolveRange(await searchParams);
  const date = { ...(range.from ? { gte: dayStart(range.from) } : {}), ...(range.to ? { lt: dayAfter(range.to) } : {}) };
  const [owners, purchases, variants, everything] = await Promise.all([
    db.stockOwner.findMany({ orderBy: { createdAt: "asc" } }),
    db.stockPurchase.findMany({ where: { purchaseDate: date }, include: { owner: true }, orderBy: [{ purchaseDate: "desc" }, { createdAt: "desc" }] }),
    db.variant.findMany({ include: { product: true }, orderBy: { sku: "asc" } }),
    db.stockPurchase.findMany({ select: { variantId: true, quantity: true, totalCost: true } }),
  ]);

  // Inventory on hand, valued at each variant's average purchase cost.
  const basis = new Map<string, { qty: number; cost: number }>();
  for (const p of everything) {
    if (!p.variantId) continue;
    const e = basis.get(p.variantId) ?? { qty: 0, cost: 0 };
    e.qty += p.quantity;
    e.cost += toNumber(p.totalCost);
    basis.set(p.variantId, e);
  }
  let inventoryValue = 0;
  let uncosted = 0;
  for (const v of variants) {
    const b = basis.get(v.id);
    if (b && b.qty > 0) inventoryValue += (b.cost / b.qty) * v.stockQty;
    else if (v.stockQty > 0) uncosted++;
  }

  const rows: PurchaseRow[] = purchases.map((p) => ({
    id: p.id,
    date: dhakaDay(p.purchaseDate),
    ownerId: p.ownerId,
    ownerName: p.owner.name,
    product: `${p.productTitleSnapshot} (${p.variantLabelSnapshot})`,
    quantity: p.quantity,
    unitCost: toNumber(p.unitCost),
    totalCost: toNumber(p.totalCost),
    supplier: p.supplierName ?? "",
    notes: p.notes ?? "",
  }));
  const total = rows.reduce((s, r) => s + r.totalCost, 0);

  return (
    <div>
      <RangeBar basePath="/admin/finance/stock" range={range} />
      <div className="mb-4.5 grid grid-cols-2 gap-4 desktop:grid-cols-4">
        <Kpi label="Stock bought (period)" value={formatTaka(total)} accent="yellow" delta={`${rows.length} purchases · ${range.label}`} />
        <Kpi label="Inventory on hand (at cost)" value={formatTaka(inventoryValue)} accent="cyan" />
      </div>
      {uncosted > 0 && (
        <Panel className="mb-4.5">
          <p className="text-[13px] text-yellow">
            {uncosted} variant{uncosted === 1 ? "" : "s"} in stock {uncosted === 1 ? "has" : "have"} no recorded purchase cost and {uncosted === 1 ? "is" : "are"} left out of that value.
          </p>
        </Panel>
      )}
      <StockManager
        rows={rows}
        total={total}
        owners={owners.map((o) => ({ id: o.id, name: o.name }))}
        variants={variants.map((v) => ({ id: v.id, label: `${v.product.title} — ${v.size}/${v.color} (${v.sku})` }))}
      />
    </div>
  );
}
