import Link from "next/link";
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
  const [owners, purchases, variants] = await Promise.all([
    db.stockOwner.findMany({ orderBy: { createdAt: "asc" } }),
    db.stockPurchase.findMany({ where: { purchaseDate: date }, include: { owner: true }, orderBy: [{ purchaseDate: "desc" }, { createdAt: "desc" }] }),
    db.variant.findMany({ include: { product: { select: { id: true, title: true, purchaseCost: true } } }, orderBy: { sku: "asc" } }),
  ]);

  // Inventory on hand, valued at each product's purchase cost (set on the product's edit page).
  let inventoryValue = 0;
  const uncosted = new Map<string, string>();
  for (const v of variants) {
    if (v.stockQty <= 0) continue;
    if (v.product.purchaseCost != null) inventoryValue += toNumber(v.product.purchaseCost) * v.stockQty;
    else uncosted.set(v.product.id, v.product.title);
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
      {uncosted.size > 0 && (
        <Panel className="mb-4.5">
          <p className="text-[13px] text-yellow">
            {uncosted.size} product{uncosted.size === 1 ? "" : "s"} in stock {uncosted.size === 1 ? "has" : "have"} no purchase cost and {uncosted.size === 1 ? "is" : "are"} left out of that value, and stock purchases of {uncosted.size === 1 ? "it" : "them"} can&apos;t be recorded until it is set — open the product and fill in <strong>Purchase cost</strong>:{" "}
            {[...uncosted.entries()].slice(0, 6).map(([id, title], i) => (
              <span key={id}>
                {i > 0 && ", "}
                <Link href={`/admin/products/${id}`} prefetch={false} className="text-cyan hover:underline">
                  {title}
                </Link>
              </span>
            ))}
            {uncosted.size > 6 && ` and ${uncosted.size - 6} more`}.
          </p>
        </Panel>
      )}
      <StockManager
        rows={rows}
        total={total}
        owners={owners.map((o) => ({ id: o.id, name: o.name }))}
        variants={variants.map((v) => ({ id: v.id, label: `${v.product.title} — ${v.size}/${v.color}`, sku: v.sku, cost: v.product.purchaseCost != null ? toNumber(v.product.purchaseCost) : null, stock: v.stockQty }))}
      />
    </div>
  );
}
