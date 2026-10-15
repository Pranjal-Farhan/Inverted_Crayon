import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCustomerSession } from "@/lib/session";
import { db } from "@/lib/db";
import { formatTaka, toNumber } from "@/lib/money";
import { OrderTimeline } from "@/components/storefront/OrderTimeline";
import { Button } from "@/components/ui/Button";
import { CANCELLABLE_STATUSES, parseVariantLabel } from "@/lib/order-status";
import { CancellationRequest } from "@/components/storefront/CancellationRequest";
import { formatDhaka } from "@/lib/message-vars";

type Props = { params: Promise<{ number: string }> };

export default async function AccountOrderDetailPage({ params }: Props) {
  const { number } = await params;
  const session = await getCustomerSession();
  if (!session) redirect("/account/login");
  const order = await db.order.findFirst({
    where: { number, customerId: session.customerId },
    include: { items: { include: { product: { select: { slug: true } } } } },
  });
  if (!order) notFound();

  return (
    <div>
      <p className="mb-3.5 text-sm text-muted">Order #{order.number}</p>
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
            <div key={item.id} className="border-b border-line py-2.5 text-sm">
              <div className="flex justify-between">
                <span>
                  {title} · Size {size}
                  {color && <> · Color {color}</>} · Qty {item.qty}
                </span>
                <span>{formatTaka(toNumber(item.lineTotal))}</span>
              </div>
            </div>
          );
        })}
        <div className="mt-2 flex justify-between font-impact text-lg">
          <span>Total</span>
          <span>{formatTaka(toNumber(order.total))}</span>
        </div>
      </div>
      {(CANCELLABLE_STATUSES as readonly string[]).includes(order.status) &&
        (order.cancellationRequestedAt ? (
          <div className="mt-4 border border-yellow/40 bg-yellow/[0.07] px-4 py-3 text-sm">
            <p className="font-label text-[13px] tracking-[1.2px] text-yellow">CANCELLATION REQUESTED</p>
            <p className="mt-1 text-muted">
              You asked to cancel this order on {formatDhaka(order.cancellationRequestedAt)}. We emailed you to say we got it, and we&apos;ll email you again once it&apos;s confirmed.
            </p>
          </div>
        ) : (
          <CancellationRequest orderNumber={order.number} />
        ))}
      {order.status === "DELIVERED" && (
        <Button href="/account/returns" size="sm" className="mt-4">
          Start a return
        </Button>
      )}
    </div>
  );
}
