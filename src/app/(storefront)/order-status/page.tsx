import Link from "next/link";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { formatTaka, toNumber } from "@/lib/money";
import { OrderTimeline } from "@/components/storefront/OrderTimeline";
import { parseVariantLabel } from "@/lib/order-status";

export const metadata: Metadata = { title: "Order status" };

type Props = { searchParams: Promise<{ number?: string }> };

/**
 * Public, order-number-only lookup (no login, no email match required) — the destination for
 * the homepage's "Track Your Order" box. Deliberately shows only this one order's contents and
 * status, never the customer's email/phone/full name/street address: a number alone doesn't
 * prove ownership, so anyone who has or guesses a number could reach this page. A customer who
 * wants the full picture (their exact delivery address, etc.) still has that via their own
 * logged-in /account/orders/[number], which checks session ownership before showing anything.
 */
export default async function OrderStatusPage({ searchParams }: Props) {
  const { number } = await searchParams;
  const trimmed = number?.trim();

  const order = trimmed
    ? await db.order.findUnique({
        where: { number: trimmed },
        include: { items: { include: { product: { select: { slug: true } } } } },
      })
    : null;
  const notFoundMsg = Boolean(trimmed) && !order;

  const zoneLabel = order
    ? order.shippingZone === "INSIDE_DHAKA"
      ? "2–3 days · Inside Dhaka"
      : "3–5 days · Outside Dhaka"
    : null;

  return (
    <div className="mx-auto my-10 max-w-[640px] border border-line bg-panel p-8">
      <h1 className="font-impact text-[30px] uppercase">Order status</h1>

      {order ? (
        <div className="mt-4">
          <p className="crumb mb-3.5">Order #{order.number}</p>
          <OrderTimeline status={order.status} />

          <div className="mt-5">
            {order.items.map((item) => {
              const { size, color } = parseVariantLabel(item.variantLabelSnapshot);
              const title = item.product ? (
                <Link href={`/product/${item.product.slug}`} className="hover:text-cyan hover:underline">
                  {item.productTitleSnapshot}
                </Link>
              ) : (
                item.productTitleSnapshot
              );
              return (
                <div key={item.id} className="flex justify-between border-b border-line py-2 text-sm">
                  <span>
                    {title} · Size {size}
                    {color && <> · Color {color}</>} · Qty {item.qty}
                  </span>
                  <span>{formatTaka(toNumber(item.lineTotal))}</span>
                </div>
              );
            })}
            <div className="mt-2 flex justify-between font-impact text-lg">
              <span>Total</span>
              <span>{formatTaka(toNumber(order.total))}</span>
            </div>
          </div>

          <p className="mt-4 text-sm text-muted">Estimated delivery {zoneLabel}.</p>
          {order.trackingCourier && (
            <p className="mt-1 text-sm text-muted">
              Courier: {order.trackingCourier} · ref {order.trackingRef ?? "—"}
            </p>
          )}
        </div>
      ) : (
        <p className="crumb my-1.5 mb-3.5">Enter your order number.</p>
      )}
      {notFoundMsg && <p className="mt-2 text-[13px] text-error">Invalid order number.</p>}

      <form className="mt-4 flex gap-2.5" action="/order-status" method="get">
        <input
          name="number"
          defaultValue={number}
          placeholder="Order number"
          className="flex-1 border border-line-2 bg-ink px-3 py-2.5 outline-none focus:border-lime"
        />
        <button type="submit" className="btn-primary bg-lime px-4 py-2 font-impact text-sm text-ink">
          Track
        </button>
      </form>
    </div>
  );
}
