import Link from "next/link";
import { db } from "@/lib/db";
import { formatTaka, toNumber } from "@/lib/money";
import { Kpi } from "@/components/admin/Kpi";
import { Panel } from "@/components/admin/Panel";
import { StatusBadge } from "@/components/admin/StatusBadge";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export default async function AdminDashboardPage() {
  const now = new Date();
  const todayStart = startOfDay(now);
  const yesterdayStart = new Date(todayStart.getTime() - 86400000);
  const weekAgo = new Date(todayStart.getTime() - 6 * 86400000);

  const [todayOrders, yesterdayOrders, allOrdersForAov, allVariants, recentOrders, weekOrders] =
    await Promise.all([
      db.order.findMany({ where: { createdAt: { gte: todayStart } } }),
      db.order.findMany({ where: { createdAt: { gte: yesterdayStart, lt: todayStart } } }),
      db.order.findMany({ select: { total: true } }),
      db.variant.findMany({ include: { product: true } }),
      db.order.findMany({ orderBy: { createdAt: "desc" }, take: 6 }),
      db.order.findMany({ where: { createdAt: { gte: weekAgo } } }),
    ]);
  const allLowStock = allVariants.filter((v) => v.stockQty <= v.lowStockThreshold);
  const lowStockVariants = allLowStock.slice(0, 6);

  const todayRevenue = todayOrders.filter((o) => o.paymentStatus === "PAID").reduce((s, o) => s + toNumber(o.total), 0);
  const yesterdayRevenue = yesterdayOrders
    .filter((o) => o.paymentStatus === "PAID")
    .reduce((s, o) => s + toNumber(o.total), 0);
  const revenueDelta =
    yesterdayRevenue > 0 ? Math.round(((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100) : null;

  const aov =
    allOrdersForAov.length > 0
      ? allOrdersForAov.reduce((s, o) => s + toNumber(o.total), 0) / allOrdersForAov.length
      : 0;

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekAgo.getTime() + i * 86400000);
    const dayTotal = weekOrders
      .filter((o) => startOfDay(o.createdAt).getTime() === d.getTime())
      .reduce((s, o) => s + toNumber(o.total), 0);
    return { label: d.toLocaleDateString("en-US", { weekday: "short" }), total: dayTotal };
  });
  const maxDay = Math.max(...days.map((d) => d.total), 1);

  return (
    <div>
      <div className="mb-5.5 grid grid-cols-2 desktop:grid-cols-4 gap-4">
        <Kpi label="Today's revenue" value={formatTaka(todayRevenue)} delta={revenueDelta != null ? `${revenueDelta >= 0 ? "▲" : "▼"} ${Math.abs(revenueDelta)}% vs yesterday` : undefined} />
        <Kpi label="Orders" value={String(todayOrders.length)} accent="pink" />
        <Kpi label="Avg order value" value={formatTaka(aov)} accent="cyan" />
        <Kpi label="Low stock" value={String(allLowStock.length)} accent="yellow" />
      </div>

      <div className="grid gap-4.5 desktop:grid-cols-[1.6fr_1fr]">
        <Panel title="Sales — last 7 days">
          <div className="flex items-end gap-2 pt-2.5" style={{ height: 160 }}>
            {days.map((d) => (
              <div key={d.label} className="relative flex-1 bg-gradient-to-t from-[#7fa315] to-lime" style={{ height: `${Math.max((d.total / maxDay) * 100, 2)}%` }}>
                <span className="absolute -bottom-[18px] left-0 right-0 text-center text-[10px] text-muted">{d.label}</span>
              </div>
            ))}
          </div>
          <p className="mt-7 text-[13px] text-muted">7-day total: {formatTaka(days.reduce((s, d) => s + d.total, 0))}</p>
        </Panel>

        <div>
          <Panel title="Recent orders">
            <table className="w-full text-sm">
              <tbody>
                {recentOrders.map((o) => (
                  <tr key={o.id} className="border-b border-line last:border-0">
                    <td className="py-2">
                      <Link href={`/admin/orders/${o.id}`} className="hover:text-lime">
                        {o.number}
                      </Link>
                    </td>
                    <td className="py-2">{o.email}</td>
                    <td className="py-2">{formatTaka(toNumber(o.total))}</td>
                    <td className="py-2 text-right">
                      <StatusBadge status={o.status} />
                    </td>
                  </tr>
                ))}
                {recentOrders.length === 0 && (
                  <tr>
                    <td className="py-2 text-muted">No orders yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </Panel>
          <Panel title="Low stock" className="mt-4.5">
            {lowStockVariants.length === 0 ? (
              <p className="text-sm text-muted">Nothing low right now.</p>
            ) : (
              <ul className="text-sm text-muted">
                {lowStockVariants.map((v) => (
                  <li key={v.id} className="py-1">
                    {v.product.title} ({v.size}) · {v.stockQty} left
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
