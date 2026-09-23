import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatTaka, toNumber } from "@/lib/money";
import { Panel } from "@/components/admin/Panel";
import { OrderTimeline } from "@/components/storefront/OrderTimeline";
import { OrderActions } from "@/components/admin/OrderActions";

type Props = { params: Promise<{ id: string }> };

export default async function AdminOrderDetailPage({ params }: Props) {
  const { id } = await params;
  const order = await db.order.findUnique({ where: { id }, include: { items: true, customer: true } });
  if (!order) notFound();

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <Link href="/admin/orders" className="text-cyan text-sm">
          ← Orders
        </Link>
        <Link
          href={`/admin/orders/${order.id}/receipt`}
          target="_blank"
          className="border border-line-2 px-3 py-1.5 text-[13px] hover:border-lime"
        >
          View / print receipt →
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-4.5 desktop:grid-cols-[1.6fr_1fr]">
        <Panel title={`Order #${order.number}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line-2 text-left text-muted">
                {["Item", "Variant", "Qty", "Total"].map((h) => (
                  <th key={h} className="font-label pb-2 text-[13px] tracking-[0.8px]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id} className="border-b border-line">
                  <td className="py-2">
                    {item.productTitleSnapshot} {item.isPreorder && <span className="text-yellow">· preorder</span>}
                  </td>
                  <td className="py-2">{item.variantLabelSnapshot}</td>
                  <td className="py-2">{item.qty}</td>
                  <td className="py-2">{formatTaka(toNumber(item.lineTotal))}</td>
                </tr>
              ))}
            </tbody>
            </table>
          </div>
          <div className="mt-3 flex justify-between text-paper">
            <span>Total paid ({order.paymentMethod})</span>
            <span className="font-impact">{formatTaka(toNumber(order.total))}</span>
          </div>
          <div className="mt-4">
            <OrderActions orderId={order.id} status={order.status} notes={order.internalNotes ?? ""} />
          </div>
        </Panel>

        <div>
          <Panel title="Customer">
            <p className="text-sm text-muted">
              {order.shippingFullName} · {order.email} · {order.phone}
              <br />
              {order.shippingLine1}, {order.shippingArea}, {order.shippingDistrict} {order.shippingPostcode}
            </p>
            {order.customer && (
              <Link href={`/admin/customers/${order.customer.id}`} className="text-cyan mt-2 inline-block text-sm">
                View customer →
              </Link>
            )}
          </Panel>
          <Panel title="Timeline" className="mt-4.5">
            <OrderTimeline status={order.status} />
            {order.trackingCourier && (
              <p className="mt-3 text-[13px] text-muted">
                {order.trackingCourier} · ref {order.trackingRef}
              </p>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
