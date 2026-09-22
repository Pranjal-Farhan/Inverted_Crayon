import { notFound } from "next/navigation";
import { getCustomerSession } from "@/lib/session";
import { db } from "@/lib/db";
import { formatTaka, toNumber } from "@/lib/money";
import { OrderTimeline } from "@/components/storefront/OrderTimeline";
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

  return (
    <div>
      <p className="mb-3.5 text-sm text-muted">Order #{order.number}</p>
      <OrderTimeline status={order.status} />
      <div className="mt-5">
        {order.items.map((item) => (
          <div key={item.id} className="flex justify-between border-b border-line py-2 text-sm">
            <span>
              {item.productTitleSnapshot} · {item.variantLabelSnapshot}
            </span>
            <span>{formatTaka(toNumber(item.lineTotal))}</span>
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
