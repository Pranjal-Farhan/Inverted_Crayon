import { db } from "@/lib/db";
import { formatTaka, toNumber } from "@/lib/money";
import { Kpi } from "@/components/admin/Kpi";
import { Panel } from "@/components/admin/Panel";
import { CATEGORIES } from "@/lib/categories";

export default async function AdminAnalyticsPage() {
  // Server Component: runs once per request, not subject to React's
  // client-render purity concerns — safe to read the current time here.
  // eslint-disable-next-line react-hooks/purity
  const since = new Date(Date.now() - 30 * 86400000);

  const [orders30d, allOrders, items] = await Promise.all([
    db.order.findMany({ where: { createdAt: { gte: since } } }),
    db.order.findMany(),
    db.orderItem.findMany({ include: { product: { include: { category: true } } } }),
  ]);

  const revenue30d = orders30d.filter((o) => o.paymentStatus === "PAID").reduce((s, o) => s + toNumber(o.total), 0);
  const aov30d = orders30d.length > 0 ? revenue30d / orders30d.length : 0;
  const refunded = allOrders.filter((o) => o.status === "REFUNDED").length;
  const returnRate = allOrders.length > 0 ? (refunded / allOrders.length) * 100 : 0;

  const byCategory = new Map<string, number>();
  for (const item of items) {
    const cat = item.product?.category.name ?? "Other";
    byCategory.set(cat, (byCategory.get(cat) ?? 0) + toNumber(item.lineTotal));
  }
  const catRows = CATEGORIES.map((c) => ({ name: c.name, total: byCategory.get(c.name) ?? 0 }));
  const maxCat = Math.max(...catRows.map((c) => c.total), 1);

  const byProduct = new Map<string, { title: string; qty: number }>();
  for (const item of items) {
    const key = item.productId ?? item.productTitleSnapshot;
    const existing = byProduct.get(key) ?? { title: item.productTitleSnapshot, qty: 0 };
    existing.qty += item.qty;
    byProduct.set(key, existing);
  }
  const topSellers = [...byProduct.values()].sort((a, b) => b.qty - a.qty).slice(0, 6);

  return (
    <div>
      <div className="mb-4.5 grid grid-cols-2 desktop:grid-cols-4 gap-4">
        <Kpi label="Revenue (30d)" value={formatTaka(revenue30d)} />
        <Kpi label="Orders (30d)" value={String(orders30d.length)} accent="pink" />
        <Kpi label="AOV (30d)" value={formatTaka(aov30d)} accent="cyan" />
        <Kpi label="Return rate" value={`${returnRate.toFixed(1)}%`} accent="yellow" />
      </div>

      <div className="grid grid-cols-1 gap-4.5 desktop:grid-cols-2">
        <Panel title="Revenue by category">
          <div className="flex items-end gap-2 pt-2.5" style={{ height: 160 }}>
            {catRows.map((c) => (
              <div key={c.name} className="relative flex-1 bg-gradient-to-t from-[#7fa315] to-lime" style={{ height: `${Math.max((c.total / maxCat) * 100, 2)}%` }}>
                <span className="absolute -bottom-[30px] left-0 right-0 text-center text-[10px] text-muted">{c.name}</span>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Top sellers">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
            <tbody>
              {topSellers.map((p) => (
                <tr key={p.title} className="border-b border-line last:border-0">
                  <td className="py-2">{p.title}</td>
                  <td className="py-2 text-right">{p.qty} sold</td>
                </tr>
              ))}
              {topSellers.length === 0 && (
                <tr>
                  <td className="py-2 text-muted">No sales yet.</td>
                </tr>
              )}
            </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}
