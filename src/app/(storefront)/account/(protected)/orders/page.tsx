import Link from "next/link";
import { getCustomerSession } from "@/lib/session";
import { db } from "@/lib/db";
import { formatTaka, toNumber } from "@/lib/money";

const BADGE: Record<string, string> = {
  PAID: "bg-lime/[0.16] text-lime",
  SHIPPED: "bg-cyan/[0.16] text-cyan",
  PENDING: "bg-yellow/[0.16] text-yellow",
  PROCESSING: "bg-cyan/[0.16] text-cyan",
  DELIVERED: "bg-lime/[0.16] text-lime",
  REFUNDED: "bg-error/[0.16] text-error",
  CANCELLED: "bg-error/[0.16] text-error",
  RETURNED: "bg-error/[0.16] text-error",
};

export default async function AccountOrdersPage() {
  const session = await getCustomerSession();
  const orders = await db.order.findMany({ where: { customerId: session!.customerId }, orderBy: { createdAt: "desc" } });

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-line-2 text-left text-muted">
          {["Order", "Date", "Total", "Status", ""].map((h) => (
            <th key={h} className="font-label px-2.5 py-2.5 text-[13px] tracking-[0.8px]">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {orders.map((o) => (
          <tr key={o.id} className="border-b border-line">
            <td className="px-2.5 py-2.5">{o.number}</td>
            <td className="px-2.5 py-2.5">{o.createdAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</td>
            <td className="px-2.5 py-2.5">{formatTaka(toNumber(o.total))}</td>
            <td className="px-2.5 py-2.5">
              <span className={`font-label px-2.5 py-0.5 text-[12px] tracking-[0.8px] ${BADGE[o.status] ?? "bg-panel-2 text-muted"}`}>{o.status}</span>
            </td>
            <td className="px-2.5 py-2.5 text-right">
              <Link href={`/account/orders/${o.number}`} className="font-label text-[12px] tracking-[1px] text-cyan">
                VIEW
              </Link>
            </td>
          </tr>
        ))}
        {orders.length === 0 && (
          <tr>
            <td colSpan={5} className="px-2.5 py-6 text-center text-muted">
              No orders yet.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
