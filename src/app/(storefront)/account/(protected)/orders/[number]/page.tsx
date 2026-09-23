import { notFound } from "next/navigation";
import { getCustomerSession } from "@/lib/session";
import { db } from "@/lib/db";
import { formatTaka, toNumber } from "@/lib/money";
import { OrderTimeline } from "@/components/storefront/OrderTimeline";
import { WriteReviewForm } from "@/components/storefront/WriteReviewForm";
import { Button } from "@/components/ui/Button";

type Props = { params: Promise<{ number: string }> };

export default async function AccountOrderDetailPage({ params }: Props) {
  const { number } = await params;
  const session = await getCustomerSession();
  const order = await db.order.findFirst({
    where: { number, customerId: session!.customerId },
    include: { items: true },
  });
  if (!order) notFound();

  const reviewedProductIds =
    order.status === "DELIVERED"
      ? new Set(
          (
            await db.review.findMany({
              where: {
                customerId: session!.customerId,
                productId: { in: order.items.map((i) => i.productId).filter((id): id is string => id != null) },
              },
              select: { productId: true },
            })
          ).map((r) => r.productId),
        )
      : new Set<string>();

  return (
    <div>
      <p className="mb-3.5 text-sm text-muted">Order #{order.number}</p>
      <OrderTimeline status={order.status} />
      <div className="mt-5">
        {order.items.map((item) => (
          <div key={item.id} className="border-b border-line py-2.5 text-sm">
            <div className="flex justify-between">
              <span>
                {item.productTitleSnapshot} · {item.variantLabelSnapshot}
              </span>
              <span>{formatTaka(toNumber(item.lineTotal))}</span>
            </div>
            {order.status === "DELIVERED" && item.productId && !reviewedProductIds.has(item.productId) && (
              <div className="mt-1.5">
                <WriteReviewForm productId={item.productId} orderNumber={order.number} productTitle={item.productTitleSnapshot} />
              </div>
            )}
            {item.productId && reviewedProductIds.has(item.productId) && (
              <p className="mt-1.5 text-[12px] text-muted">Reviewed — thanks!</p>
            )}
          </div>
        ))}
        <div className="mt-2 flex justify-between font-impact text-lg">
          <span>Total</span>
          <span>{formatTaka(toNumber(order.total))}</span>
        </div>
      </div>
      {order.status === "DELIVERED" && (
        <Button href="/account/returns" size="sm" className="mt-4">
          Start a return
        </Button>
      )}
    </div>
  );
}
