import { db } from "@/lib/db";
import { formatTaka, toNumber } from "@/lib/money";
import { Kpi } from "@/components/admin/Kpi";
import { Panel } from "@/components/admin/Panel";
import { StockOwnerForm, StockPurchaseForm } from "@/components/admin/FinanceForms";

export default async function AdminFinancePage() {
  const [owners, purchases, variants, paidOrders] = await Promise.all([
    db.stockOwner.findMany({ orderBy: { createdAt: "asc" } }),
    db.stockPurchase.findMany({
      include: { owner: true },
      orderBy: { purchaseDate: "desc" },
      take: 200,
    }),
    db.variant.findMany({ include: { product: true }, orderBy: { sku: "asc" } }),
    db.order.findMany({
      where: { paymentStatus: "PAID" },
      include: { items: true },
    }),
  ]);

  // Weighted-average unit cost per variant, from every purchase on record for it.
  const costBasis = new Map<string, { totalQty: number; totalCost: number }>();
  for (const p of purchases) {
    if (!p.variantId) continue;
    const entry = costBasis.get(p.variantId) ?? { totalQty: 0, totalCost: 0 };
    entry.totalQty += p.quantity;
    entry.totalCost += toNumber(p.totalCost);
    costBasis.set(p.variantId, entry);
  }
  const avgCost = (variantId: string) => {
    const entry = costBasis.get(variantId);
    return entry && entry.totalQty > 0 ? entry.totalCost / entry.totalQty : null;
  };

  // Revenue + COGS from every item on a paid order. Units of a variant with no purchase history
  // have no known cost basis, so they're counted toward revenue but flagged out of COGS.
  let revenue = 0;
  let cogs = 0;
  let unitsSoldWithoutCostBasis = 0;
  for (const order of paidOrders) {
    revenue += toNumber(order.total);
    for (const item of order.items) {
      if (!item.variantId) {
        unitsSoldWithoutCostBasis += item.qty;
        continue;
      }
      const cost = avgCost(item.variantId);
      if (cost === null) {
        unitsSoldWithoutCostBasis += item.qty;
        continue;
      }
      cogs += cost * item.qty;
    }
  }
  const grossProfit = revenue - cogs;
  const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

  // Capital invested per owner, and current inventory value at cost (remaining stock * avg cost).
  const capitalByOwner = new Map<string, number>();
  let totalCapital = 0;
  for (const p of purchases) {
    const amt = toNumber(p.totalCost);
    capitalByOwner.set(p.ownerId, (capitalByOwner.get(p.ownerId) ?? 0) + amt);
    totalCapital += amt;
  }

  let inventoryValue = 0;
  let variantsWithoutCostBasis = 0;
  for (const v of variants) {
    const cost = avgCost(v.id);
    if (cost === null) {
      if (v.stockQty > 0) variantsWithoutCostBasis++;
      continue;
    }
    inventoryValue += cost * v.stockQty;
  }

  const ownerRows = owners
    .map((o) => {
      const capital = capitalByOwner.get(o.id) ?? 0;
      const share = totalCapital > 0 ? capital / totalCapital : 0;
      return { ...o, capital, share, profitShare: grossProfit * share };
    })
    .sort((a, b) => b.capital - a.capital);

  const variantOptions = variants.map((v) => ({
    id: v.id,
    label: `${v.product.title} — ${v.size}/${v.color} (${v.sku})`,
  }));

  return (
    <div>
      <div className="mb-4.5 grid grid-cols-2 desktop:grid-cols-4 gap-4">
        <Kpi label="Capital invested" value={formatTaka(totalCapital)} />
        <Kpi label="Revenue (paid orders)" value={formatTaka(revenue)} accent="cyan" />
        <Kpi label="Gross profit" value={formatTaka(grossProfit)} accent="pink" />
        <Kpi label="Gross margin" value={`${grossMargin.toFixed(1)}%`} accent="yellow" />
      </div>

      <div className="mb-4.5 grid grid-cols-1 gap-4.5 desktop:grid-cols-2">
        <StockOwnerForm />
        <StockPurchaseForm owners={owners} variants={variantOptions} />
      </div>

      <div className="mb-4.5 grid grid-cols-1 gap-4.5 desktop:grid-cols-2">
        <Panel title="Financial summary">
          <div className="mb-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <span className="text-muted">Cost of goods sold</span>
            <span className="text-right">{formatTaka(cogs)}</span>
            <span className="text-muted">Current inventory value (at cost)</span>
            <span className="text-right">{formatTaka(inventoryValue)}</span>
          </div>
          {(unitsSoldWithoutCostBasis > 0 || variantsWithoutCostBasis > 0) && (
            <p className="text-[12px] text-yellow">
              {unitsSoldWithoutCostBasis > 0 &&
                `${unitsSoldWithoutCostBasis} sold unit${unitsSoldWithoutCostBasis === 1 ? "" : "s"} have no recorded purchase cost and are excluded from COGS. `}
              {variantsWithoutCostBasis > 0 &&
                `${variantsWithoutCostBasis} variant${variantsWithoutCostBasis === 1 ? "" : "s"} in stock have no recorded purchase cost and are excluded from inventory value.`}
            </p>
          )}
        </Panel>

        <Panel title="Capital by owner" className="!p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line-2 text-left text-muted">
                  {["Owner", "Invested", "Share", "Profit share"].map((h) => (
                    <th key={h} className="font-label px-4 py-2.5 text-[13px] tracking-[0.8px]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ownerRows.map((o) => (
                  <tr key={o.id} className="border-b border-line">
                    <td className="px-4 py-2.5">{o.name}</td>
                    <td className="px-4 py-2.5">{formatTaka(o.capital)}</td>
                    <td className="px-4 py-2.5">{(o.share * 100).toFixed(1)}%</td>
                    <td className="px-4 py-2.5">{formatTaka(o.profitShare)}</td>
                  </tr>
                ))}
                {ownerRows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-muted">
                      No owners yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <Panel title="Purchase history" className="!p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line-2 text-left text-muted">
                {["Date", "Owner", "Product", "Qty", "Unit cost", "Total", "Supplier"].map((h) => (
                  <th key={h} className="font-label px-4 py-2.5 text-[13px] tracking-[0.8px]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {purchases.map((p) => (
                <tr key={p.id} className="border-b border-line">
                  <td className="px-4 py-2.5">{p.purchaseDate.toLocaleDateString()}</td>
                  <td className="px-4 py-2.5">{p.owner.name}</td>
                  <td className="px-4 py-2.5">
                    {p.productTitleSnapshot} ({p.variantLabelSnapshot})
                  </td>
                  <td className="px-4 py-2.5">{p.quantity}</td>
                  <td className="px-4 py-2.5">{formatTaka(p.unitCost.toString())}</td>
                  <td className="px-4 py-2.5">{formatTaka(p.totalCost.toString())}</td>
                  <td className="px-4 py-2.5">{p.supplierName ?? "—"}</td>
                </tr>
              ))}
              {purchases.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-muted">
                    No stock purchases recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
