import { getCustomerSession } from "@/lib/session";
import { db } from "@/lib/db";

export default async function AccountBackInStockPage() {
  const session = await getCustomerSession();
  const subs = await db.backInStockSubscription.findMany({
    where: { customerId: session!.customerId },
    include: { variant: { include: { product: true } } },
    orderBy: { createdAt: "desc" },
  });

  if (subs.length === 0) {
    return <p className="text-muted">No back-in-stock alerts yet — tap &quot;Notify me&quot; on a sold-out product.</p>;
  }

  return (
    <ul>
      {subs.map((s) => (
        <li key={s.id} className="flex items-center justify-between border-b border-line py-2.5 text-sm">
          <span>
            {s.variant.product.title} · {s.variant.size} / {s.variant.color}
          </span>
          <span className="text-muted">{s.notifiedAt ? "Notified" : "Watching"}</span>
        </li>
      ))}
    </ul>
  );
}
