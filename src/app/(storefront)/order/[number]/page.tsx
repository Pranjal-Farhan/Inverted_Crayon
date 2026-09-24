import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { formatTaka, toNumber } from "@/lib/money";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Order confirmed" };

type Props = { params: Promise<{ number: string }> };

export default async function OrderConfirmationPage({ params }: Props) {
  const { number } = await params;
  const order = await db.order.findUnique({ where: { number }, include: { items: true } });
  if (!order) notFound();

  const zoneLabel =
    order.shippingZone === "INSIDE_DHAKA" ? "2–3 days · Dhaka" : order.shippingZone === "OUTSIDE_DHAKA" ? "3–5 days" : "7–14 days · International";

  return (
    <div className="mx-auto my-10 max-w-[640px] border border-line bg-panel p-8">
      <div className="mb-4 grid h-16 w-16 place-items-center rounded-full bg-lime">
        <svg viewBox="0 0 24 24" className="h-[30px] w-[30px]" fill="none" stroke="#0c0c0d" strokeWidth="3">
          <path d="M4 12l6 6L20 5" />
        </svg>
      </div>
      <h1 className="font-impact text-[34px] uppercase">Order placed.</h1>
      <p className="crumb my-1.5">
        Order #{order.number} · confirmation sent to {order.email}
      </p>

      {order.items.map((item) => (
        <div key={item.id} className="flex justify-between py-1.5 text-sm text-[#ddd]">
          <span>
            {item.productTitleSnapshot} · {item.variantLabelSnapshot}
            {item.isPreorder && <span className="ml-1.5 text-[12px] text-yellow">· preorder</span>}
          </span>
          <span>{formatTaka(toNumber(item.lineTotal))}</span>
        </div>
      ))}
      <div className="mt-2 flex justify-between border-t border-line pt-3">
        <span className="font-impact text-xl">{order.isPreorder ? "Paid now" : `Paid (${order.paymentMethod})`}</span>
        <span className="price text-xl">{formatTaka(toNumber(order.advanceAmount))}</span>
      </div>
      {toNumber(order.balanceDue) > 0 && (
        <div className="flex justify-between py-1 text-sm text-muted">
          <span>Due on delivery (cash)</span>
          <span>{formatTaka(toNumber(order.balanceDue))}</span>
        </div>
      )}

      <p className="mt-4 text-sm text-muted">Estimated delivery {zoneLabel}.</p>
      {order.isPreorder && (
        <p className="mt-1 text-sm text-yellow">
          Includes a preorder item — {order.preorderShipMode === "split" ? "in-stock items ship first, preorder follows." : "your order ships together once the preorder lands."}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2.5">
        <Button href="/track" size="sm">
          Track order
        </Button>
        <Link href="/account/register" className="ghost inline-flex items-center gap-2.5 border border-line-2 px-5 py-2.5 font-impact text-sm">
          Create account
        </Link>
      </div>
    </div>
  );
}
