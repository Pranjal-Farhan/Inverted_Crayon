import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatTaka, toNumber } from "@/lib/money";
import { getStoreInfo, getTaxSettings } from "@/lib/store-settings";
import { Monogram } from "@/components/brand/Monogram";
import { Wordmark } from "@/components/brand/Wordmark";
import { ReceiptToolbar } from "@/components/admin/PrintButton";

type Props = { params: Promise<{ id: string }> };

const SHIPPING_ZONE_LABEL: Record<string, string> = {
  INSIDE_DHAKA: "Inside Dhaka",
  OUTSIDE_DHAKA: "Outside Dhaka",
  INTERNATIONAL: "International",
};

export default async function OrderReceiptPage({ params }: Props) {
  const { id } = await params;
  const [order, store, tax] = await Promise.all([
    db.order.findUnique({ where: { id }, include: { items: true } }),
    getStoreInfo(),
    getTaxSettings(),
  ]);
  if (!order) notFound();

  const issuedAt = order.createdAt.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="bg-paper text-ink min-h-screen px-5 py-10 print:p-0">
      <ReceiptToolbar backHref={`/admin/orders/${order.id}`} />

      <div className="mx-auto max-w-[680px] border border-ink/15 bg-white p-8 print:border-0 print:p-0 desktop:p-10">
        {/* header */}
        <div className="flex items-start justify-between gap-6 border-b border-ink/15 pb-6">
          <div className="flex items-center gap-3">
            <Monogram className="h-[40px] w-[56px]" />
            <Wordmark className="text-[15px] leading-[0.9]" stacked={false} />
          </div>
          <div className="text-right text-[13px] text-ink/60">
            <div className="font-medium text-ink">{store.name}</div>
            <div>{store.address}</div>
            <div>{store.email}</div>
            <div>{store.phone}</div>
          </div>
        </div>

        {/* title + meta */}
        <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-impact text-[28px] uppercase tracking-[0.5px]">Receipt</h1>
            <p className="mt-1 text-[13px] text-ink/60">Order #{order.number}</p>
          </div>
          <div className="text-right text-[13px]">
            <div>
              <span className="text-ink/50">Issued</span> {issuedAt}
            </div>
            <div className="mt-1">
              <span className="text-ink/50">Order status</span>{" "}
              <span className="font-label tracking-[0.6px]">{order.status}</span>
            </div>
            <div className="mt-1">
              <span className="text-ink/50">Payment</span>{" "}
              <span className="font-label tracking-[0.6px]">
                {order.paymentMethod} · {order.paymentStatus}
              </span>
            </div>
          </div>
        </div>

        {/* billed to / ship to */}
        <div className="mt-6 grid grid-cols-2 gap-6 border-b border-ink/15 pb-6 text-[13px]">
          <div>
            <p className="font-label mb-1.5 tracking-[1px] text-ink/50">BILLED TO</p>
            <p>{order.shippingFullName}</p>
            <p className="text-ink/70">{order.email}</p>
            <p className="text-ink/70">{order.phone}</p>
          </div>
          <div>
            <p className="font-label mb-1.5 tracking-[1px] text-ink/50">SHIP TO</p>
            <p>{order.shippingFullName}</p>
            <p className="text-ink/70">
              {order.shippingLine1}, {order.shippingArea}
            </p>
            <p className="text-ink/70">
              {order.shippingDistrict} {order.shippingPostcode}, {order.shippingCountry}
            </p>
            <p className="text-ink/70">{SHIPPING_ZONE_LABEL[order.shippingZone] ?? order.shippingZone}</p>
          </div>
        </div>

        {/* items */}
        <table className="mt-6 w-full text-[13px]">
          <thead>
            <tr className="border-b border-ink/20 text-left text-ink/50">
              <th className="font-label pb-2 font-normal tracking-[0.8px]">Item</th>
              <th className="font-label pb-2 font-normal tracking-[0.8px]">Variant</th>
              <th className="font-label pb-2 text-right font-normal tracking-[0.8px]">Qty</th>
              <th className="font-label pb-2 text-right font-normal tracking-[0.8px]">Unit price</th>
              <th className="font-label pb-2 text-right font-normal tracking-[0.8px]">Total</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id} className="border-b border-ink/10">
                <td className="py-2.5 pr-3">
                  {item.productTitleSnapshot}
                  {item.isPreorder && (
                    <span className="ml-1.5 text-[11px] text-ink/50">
                      · preorder
                      {item.preorderAdvanceAmount != null &&
                        ` (advance ${formatTaka(toNumber(item.preorderAdvanceAmount))}/unit)`}
                    </span>
                  )}
                </td>
                <td className="py-2.5 pr-3 text-ink/70">{item.variantLabelSnapshot}</td>
                <td className="py-2.5 text-right">{item.qty}</td>
                <td className="py-2.5 text-right">{formatTaka(toNumber(item.unitPrice))}</td>
                <td className="py-2.5 text-right">{formatTaka(toNumber(item.lineTotal))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* totals */}
        <div className="mt-4 flex justify-end">
          <div className="w-full max-w-[280px] text-[13px]">
            <div className="flex justify-between py-1">
              <span className="text-ink/60">Subtotal</span>
              <span>{formatTaka(toNumber(order.subtotal))}</span>
            </div>
            {toNumber(order.discountAmount) > 0 && (
              <div className="flex justify-between py-1">
                <span className="text-ink/60">Coupon{order.discountCode ? ` · ${order.discountCode}` : ""}</span>
                <span>-{formatTaka(toNumber(order.discountAmount))}</span>
              </div>
            )}
            <div className="flex justify-between py-1">
              <span className="text-ink/60">Shipping</span>
              <span>{formatTaka(toNumber(order.shippingCost))}</span>
            </div>
            <div className="mt-1.5 flex justify-between border-t border-ink/20 pt-2">
              <span className="font-impact text-[16px] uppercase">Total</span>
              <span className="font-impact text-[16px]">{formatTaka(toNumber(order.total))}</span>
            </div>
            {order.isPreorder && (
              <>
                <div className="mt-1.5 flex justify-between border-t border-dashed border-ink/15 pt-1.5 text-ink/70">
                  <span>Paid now (advance)</span>
                  <span>{formatTaka(toNumber(order.advanceAmount))}</span>
                </div>
                <div className="flex justify-between text-ink/70">
                  <span>Due on delivery (cash){order.balanceCollected ? " — collected" : ""}</span>
                  <span>{formatTaka(toNumber(order.balanceDue))}</span>
                </div>
              </>
            )}
            <p className="mt-1.5 text-right text-[11px] text-ink/45">
              {tax.rate > 0 ? `Includes ${tax.rate}% ${tax.label}` : tax.label}
            </p>
          </div>
        </div>

        {order.trackingCourier && (
          <div className="mt-4 border-t border-ink/15 pt-4 text-[13px] text-ink/70">
            Shipped via {order.trackingCourier} · ref {order.trackingRef}
          </div>
        )}

        {/* footer */}
        <div className="mt-8 border-t border-ink/15 pt-5 text-center">
          <p className="font-scrawl text-lg">Thanks for standing out.</p>
          <p className="mt-1 text-[12px] text-ink/50">
            Questions about this order? {store.email} · {store.phone}
          </p>
        </div>
      </div>
    </div>
  );
}
