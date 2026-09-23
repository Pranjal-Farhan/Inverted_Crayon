import Link from "next/link";
import { db } from "@/lib/db";
import { formatTaka, toNumber } from "@/lib/money";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Panel } from "@/components/admin/Panel";
import type { $Enums } from "@/generated/prisma/client";

type Props = {
  searchParams: Promise<{ status?: string; payment?: string; q?: string }>;
};

const STATUSES: $Enums.OrderStatus[] = [
  "PENDING",
  "PAID",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
  "RETURNED",
];
const PAYMENT_METHODS: $Enums.PaymentMethod[] = ["BKASH", "NAGAD", "SSLCOMMERZ", "COD"];

export default async function AdminOrdersPage({ searchParams }: Props) {
  const { status, payment, q } = await searchParams;

  const orders = await db.order.findMany({
    where: {
      status: status && STATUSES.includes(status as $Enums.OrderStatus) ? (status as $Enums.OrderStatus) : undefined,
      paymentMethod:
        payment && PAYMENT_METHODS.includes(payment as $Enums.PaymentMethod)
          ? (payment as $Enums.PaymentMethod)
          : undefined,
      OR: q
        ? [{ number: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }]
        : undefined,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div>
      <form className="mb-3.5 flex flex-wrap items-center gap-2.5" method="get">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search orders…"
          className="border border-line-2 bg-panel px-2.5 py-2 text-sm outline-none focus:border-lime"
        />
        <select name="status" defaultValue={status ?? ""} className="border border-line-2 bg-panel px-2.5 py-2 text-sm">
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select name="payment" defaultValue={payment ?? ""} className="border border-line-2 bg-panel px-2.5 py-2 text-sm">
          <option value="">All payments</option>
          {PAYMENT_METHODS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <button type="submit" className="border border-line-2 px-3 py-2 text-sm hover:border-lime">
          Filter
        </button>
      </form>

      <Panel className="!p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line-2 text-left text-muted">
              {["Order", "Customer", "Total", "Payment", "Status", "Date"].map((h) => (
                <th key={h} className="font-label px-4 py-2.5 text-[13px] tracking-[0.8px]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="group border-b border-line hover:bg-panel-2">
                <td className="p-0">
                  <Link href={`/admin/orders/${o.id}`} className="block px-4 py-2.5 group-hover:text-lime">
                    {o.number}
                  </Link>
                </td>
                <td className="p-0">
                  <Link href={`/admin/orders/${o.id}`} className="block px-4 py-2.5">
                    {o.email}
                  </Link>
                </td>
                <td className="p-0">
                  <Link href={`/admin/orders/${o.id}`} className="block px-4 py-2.5">
                    {formatTaka(toNumber(o.total))}
                  </Link>
                </td>
                <td className="p-0">
                  <Link href={`/admin/orders/${o.id}`} className="block px-4 py-2.5">
                    {o.paymentMethod}
                  </Link>
                </td>
                <td className="p-0">
                  <Link href={`/admin/orders/${o.id}`} className="block px-4 py-2.5">
                    <StatusBadge status={o.status} />
                  </Link>
                </td>
                <td className="p-0">
                  <Link href={`/admin/orders/${o.id}`} className="block px-4 py-2.5">
                    {o.createdAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                  </Link>
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted">
                  No orders match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
