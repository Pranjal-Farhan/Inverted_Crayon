import { getCustomerSession } from "@/lib/session";
import { db } from "@/lib/db";
import { ReturnRequestForm } from "@/components/storefront/ReturnRequestForm";

export default async function AccountReturnsPage() {
  const session = await getCustomerSession();
  const orders = await db.order.findMany({
    where: { customerId: session!.customerId, status: "DELIVERED" },
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <p className="mb-3.5 text-muted">Not the right fit? Start a return against a delivered order.</p>
      <ReturnRequestForm
        orders={orders.map((o) => ({
          id: o.id,
          number: o.number,
          items: o.items.map((i) => ({ id: i.id, productTitleSnapshot: i.productTitleSnapshot, variantLabelSnapshot: i.variantLabelSnapshot })),
        }))}
      />
    </div>
  );
}
