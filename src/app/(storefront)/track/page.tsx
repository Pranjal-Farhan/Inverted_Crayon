import type { Metadata } from "next";
import { db } from "@/lib/db";
import { OrderTimeline } from "@/components/storefront/OrderTimeline";

export const metadata: Metadata = { title: "Track order" };

type Props = { searchParams: Promise<{ number?: string; email?: string }> };

export default async function TrackPage({ searchParams }: Props) {
  const { number, email } = await searchParams;
  let order = null;
  let notFoundMsg = false;

  if (number && email) {
    order = await db.order.findFirst({
      where: { number: number.trim(), email: { equals: email.trim(), mode: "insensitive" } },
    });
    if (!order) notFoundMsg = true;
  }

  return (
    <div className="mx-auto my-10 max-w-[640px] border border-line bg-panel p-8">
      <h1 className="font-impact text-[30px] uppercase">Track order</h1>
      {order ? (
        <>
          <p className="crumb my-1.5 mb-3.5">Order #{order.number}</p>
          <OrderTimeline status={order.status} />
          <p className="mt-4.5 text-sm text-muted">
            {order.trackingCourier
              ? `Courier: ${order.trackingCourier} · ref ${order.trackingRef ?? "—"}`
              : "Courier assigned once shipped."}
          </p>
        </>
      ) : (
        <p className="crumb my-1.5 mb-3.5">Enter your order number and email.</p>
      )}
      {notFoundMsg && <p className="mt-2 text-[13px] text-error">No order matched those details.</p>}

      <form className="mt-4" action="/track" method="get">
        <div className="frow grid grid-cols-2 gap-2.5">
          <input
            name="number"
            defaultValue={number}
            placeholder="Order number"
            className="border border-line-2 bg-ink px-3 py-2.5 outline-none focus:border-lime"
          />
          <input
            name="email"
            defaultValue={email}
            placeholder="Email"
            className="border border-line-2 bg-ink px-3 py-2.5 outline-none focus:border-lime"
          />
        </div>
        <button
          type="submit"
          className="btn-primary mt-2.5 bg-lime px-4 py-2 font-impact text-sm text-ink"
        >
          Track
        </button>
      </form>
    </div>
  );
}
