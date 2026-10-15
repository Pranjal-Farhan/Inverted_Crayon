import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatTaka, toNumber } from "@/lib/money";
import { Panel } from "@/components/admin/Panel";
import { OrderTimeline } from "@/components/storefront/OrderTimeline";
import { OrderActions } from "@/components/admin/OrderActions";
import { Avatar } from "@/components/ui/Avatar";
import { formatDhaka } from "@/lib/message-vars";

type Props = { params: Promise<{ id: string }> };

export default async function AdminOrderDetailPage({ params }: Props) {
  const { id } = await params;
  const order = await db.order.findUnique({
    where: { id },
    include: {
      items: { include: { product: { select: { slug: true } } } },
      customer: true,
      couponRedemption: { include: { discount: { select: { code: true, type: true } } } },
    },
  });
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
        <Panel>
          <div className="mb-3.5 flex items-center gap-2.5">
            <h3 className="font-impact text-[17px] uppercase tracking-[0.5px]">Order #{order.number}</h3>
            {order.isPreorder && (
              <span className="font-label inline-block bg-yellow px-2.5 py-0.5 text-[11px] tracking-[0.8px] text-ink">
                PREORDER ITEM
              </span>
            )}
          </div>
          {order.cancellationRequestedAt && (
            <div className="mb-3.5 border border-yellow/40 bg-yellow/[0.07] px-3.5 py-2.5 text-sm">
              <p className="font-label text-[12px] tracking-[1.2px] text-yellow">
                CUSTOMER REQUESTED CANCELLATION
                {(order.status === "REFUNDED" || order.status === "CANCELLED") && " · HANDLED"}
              </p>
              <p className="mt-1 text-muted">
                {formatDhaka(order.cancellationRequestedAt)} — {order.cancellationReason ?? "no reason given"}
              </p>
              {order.status !== "REFUNDED" && order.status !== "CANCELLED" && (
                <p className="mt-1 text-[12px] text-muted-2">
                  Nothing has been cancelled yet. Use Refund below to cancel the order and restore its stock, or contact the customer.
                </p>
              )}
            </div>
          )}
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
                    {item.product ? (
                      <Link href={`/product/${item.product.slug}`} target="_blank" className="hover:text-cyan hover:underline">
                        {item.productTitleSnapshot}
                      </Link>
                    ) : (
                      item.productTitleSnapshot
                    )}{" "}
                    {item.isPreorder && <span className="text-yellow">· preorder</span>}
                  </td>
                  <td className="py-2">{item.variantLabelSnapshot}</td>
                  <td className="py-2">{item.qty}</td>
                  <td className="py-2">{formatTaka(toNumber(item.lineTotal))}</td>
                </tr>
              ))}
            </tbody>
            </table>
          </div>
          <div className="mt-3 border-t border-line pt-3">
            {order.discountCode && (
              <div className="mb-2 flex justify-between text-sm">
                <span className="text-muted">
                  Coupon ·{" "}
                  <Link href="/admin/discounts" className="text-cyan hover:underline">
                    {order.discountCode}
                  </Link>
                </span>
                <span className="text-lime">
                  {order.couponRedemption?.discount.type === "FREE_SHIPPING"
                    ? `Free delivery (${formatTaka(toNumber(order.couponRedemption.amount))} waived)`
                    : `−${formatTaka(toNumber(order.couponRedemption?.amount ?? order.discountAmount))}`}
                </span>
              </div>
            )}
            <div className="flex justify-between text-paper">
              <span className="font-impact">Order total</span>
              <span className="font-impact">{formatTaka(toNumber(order.total))}</span>
            </div>
            <div className="mt-1 flex justify-between text-sm text-muted">
              <span>Payment method</span>
              <span>{order.paymentMethod}</span>
            </div>
            {order.isPreorder && (
              <p className="mt-2 text-[13px] text-yellow">Preorder Now and Our Sales Agent Will Reach Out.</p>
            )}
          </div>
          <div className="mt-4">
            <OrderActions
              orderId={order.id}
              status={order.status}
              notes={order.internalNotes ?? ""}
              balanceDue={toNumber(order.balanceDue)}
              balanceCollected={order.balanceCollected}
            />
          </div>
        </Panel>

        <div>
          <Panel title="Customer">
            {order.customer ? (
              <span className="font-label mb-2 inline-block px-2 py-0.5 text-[11px] tracking-[0.8px] text-lime">
                HAS ACCOUNT
              </span>
            ) : (
              <span className="font-label mb-2 inline-block px-2 py-0.5 text-[11px] tracking-[0.8px] text-muted-2">
                GUEST ORDER — NO ACCOUNT
              </span>
            )}
            <div className="flex items-center gap-3">
              {order.customer && (
                <Avatar src={order.customer.avatarUrl} name={order.shippingFullName} email={order.email} size={40} />
              )}
              <p className="text-sm text-muted">
                {order.shippingFullName} · {order.email} · {order.phone}
                <br />
                {order.shippingLine1}, {order.shippingArea}, {order.shippingDistrict} {order.shippingPostcode}
              </p>
            </div>
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
