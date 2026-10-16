import Link from "next/link";
import { requireAdminPage } from "@/lib/admin-guard";
import { db } from "@/lib/db";
import { toNumber, formatTaka } from "@/lib/money";
import { Kpi } from "@/components/admin/Kpi";
import { Panel } from "@/components/admin/Panel";
import { RangeBar } from "@/components/admin/finance/RangeBar";
import { InvestmentsManager, type LegacyRow, type OwnerRow, type ShipmentRow, type VariantOption } from "@/components/admin/finance/InvestmentsManager";
import { loadFinance, ownerSummary } from "@/lib/finance";
import { dhakaDay, inRange, resolveRange, todayDhaka } from "@/lib/finance-dates";

type Props = { searchParams: Promise<{ range?: string; from?: string; to?: string }> };

export default async function FinanceInvestmentsPage({ searchParams }: Props) {
  await requireAdminPage("finance");
  const range = resolveRange(await searchParams);
  const [data, variants] = await Promise.all([
    loadFinance(),
    // purchaseCost is left out of queries unless asked for (lib/db.ts).
    db.variant.findMany({ include: { product: { select: { id: true, title: true, purchaseCost: true } } }, orderBy: { sku: "asc" } }),
  ]);
  const owners = ownerSummary(data);

  const inPeriod = data.investments.filter((i) => inRange(i.date, range));
  const rows: ShipmentRow[] = inPeriod.map((i) => ({
    id: i.id,
    date: dhakaDay(i.date),
    ownerId: i.ownerId,
    ownerName: i.owner.name,
    supplier: i.supplierName ?? "",
    description: i.description ?? "",
    method: i.method,
    notes: i.notes ?? "",
    shipmentCost: toNumber(i.shipmentCost),
    goods: i.items.reduce((t, x) => t + toNumber(x.lineTotal), 0),
    amount: toNumber(i.amount),
    items: i.items.map((x) => ({ variantId: x.variantId, label: `${x.productTitleSnapshot} (${x.variantLabelSnapshot})`, quantity: x.quantity, unitCost: toNumber(x.unitCost), lineTotal: toNumber(x.lineTotal) })),
  }));
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const shipping = rows.reduce((s, r) => s + r.shipmentCost, 0);
  const legacy: LegacyRow[] = data.legacyCapital.map((i) => ({ id: i.id, date: dhakaDay(i.date), ownerName: i.owner.name, amount: toNumber(i.amount), description: i.description ?? "" }));
  const ownerRows: OwnerRow[] = owners.rows.map((o) => ({ id: o.id, name: o.name, contact: o.contact ?? "", notes: o.notes ?? "", invested: o.invested, shipments: o.shipments, expensesPaid: o.expensesPaid }));

  // What's on the shelf right now, at each product's purchase cost; products in stock with no cost are listed.
  let inventoryValue = 0;
  const uncosted = new Map<string, string>();
  for (const v of variants) {
    if (v.stockQty <= 0) continue;
    if (v.product.purchaseCost != null) inventoryValue += toNumber(v.product.purchaseCost) * v.stockQty;
    else uncosted.set(v.product.id, v.product.title);
  }
  const options: VariantOption[] = variants.map((v) => ({
    id: v.id,
    label: `${v.product.title} — ${v.size}/${v.color}`,
    sku: v.sku,
    productId: v.product.id,
    productTitle: v.product.title,
    cost: v.product.purchaseCost != null ? toNumber(v.product.purchaseCost) : null,
    stock: v.stockQty,
  }));

  return (
    <div>
      <RangeBar basePath="/admin/finance/investments" range={range} />
      <div className="mb-4.5 grid grid-cols-2 gap-4 desktop:grid-cols-4">
        <Kpi label="Invested (period)" value={formatTaka(total)} accent="cyan" delta={`${rows.length} ${rows.length === 1 ? "shipment" : "shipments"} · ${range.label}`} />
        <Kpi label="Of which shipment cost" value={formatTaka(shipping)} accent="yellow" delta="freight, customs… (counts against profit)" />
        <Kpi label="Invested (all time)" value={formatTaka(owners.totalInvested)} accent="lime" />
        <Kpi label="Inventory on hand (at cost)" value={formatTaka(inventoryValue)} accent="pink" delta="stock now × purchase cost" />
      </div>
      {uncosted.size > 0 && (
        <Panel className="mb-4.5">
          <p className="text-[13px] text-yellow">
            {uncosted.size} product{uncosted.size === 1 ? "" : "s"} in stock {uncosted.size === 1 ? "has" : "have"} no purchase cost and {uncosted.size === 1 ? "is" : "are"} left out of the inventory value — a shipment you record for {uncosted.size === 1 ? "it" : "them"} fills it in, or open the product and set <strong>Purchase cost</strong>:{" "}
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
      <InvestmentsManager rows={rows} legacy={legacy} owners={ownerRows} variants={options} today={todayDhaka()} total={total} />
    </div>
  );
}
