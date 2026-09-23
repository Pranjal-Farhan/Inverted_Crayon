import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatTaka, toNumber } from "@/lib/money";
import { Panel } from "@/components/admin/Panel";
import { StatusBadge } from "@/components/admin/StatusBadge";

type Props = { params: Promise<{ id: string }> };

export default async function AdminCustomerDetailPage({ params }: Props) {
  const { id } = await params;
  const customer = await db.customer.findUnique({
    where: { id },
    include: { orders: { orderBy: { createdAt: "desc" } }, addresses: true },
  });
  if (!customer) notFound();

  const ltv = customer.orders.reduce((s, o) => s + toNumber(o.total), 0);

  return (
    <div>
      <Link href="/admin/customers" className="text-cyan mb-3 inline-block text-sm">
        ← Customers
      </Link>
      <div className="grid grid-cols-1 gap-4.5 desktop:grid-cols-[1.6fr_1fr]">
        <Panel title="Orders">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line-2 text-left text-muted">
                {["Order", "Total", "Status", "Date"].map((h) => (
                  <th key={h} className="font-label pb-2 text-[13px] tracking-[0.8px]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {customer.orders.map((o) => (
                <tr key={o.id} className="border-b border-line">
                  <td className="py-2">
                    <Link href={`/admin/orders/${o.id}`} className="hover:text-lime">
                      {o.number}
                    </Link>
                  </td>
                  <td className="py-2">{formatTaka(toNumber(o.total))}</td>
                  <td className="py-2">
                    <StatusBadge status={o.status} />
                  </td>
                  <td className="py-2">{o.createdAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</td>
                </tr>
              ))}
              {customer.orders.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 text-muted">
                    No orders yet.
                  </td>
                </tr>
              )}
            </tbody>
            </table>
          </div>
        </Panel>

        <div>
          <Panel title="Profile">
            <p className="text-sm text-muted">
              {customer.name ?? "—"} · {customer.email}
              <br />
              {customer.phone ?? "No phone on file"}
            </p>
            <p className="mt-2 text-sm">
              LTV: <span className="text-lime">{formatTaka(ltv)}</span>
            </p>
            {customer.segmentTags.length > 0 && (
              <div className="mt-2 flex gap-1.5">
                {customer.segmentTags.map((t) => (
                  <span key={t} className="font-label bg-cyan/[0.16] px-2 py-0.5 text-[12px] text-cyan">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </Panel>
          <Panel title="Addresses" className="mt-4.5">
            {customer.addresses.length === 0 ? (
              <p className="text-sm text-muted">No saved addresses.</p>
            ) : (
              customer.addresses.map((a) => (
                <p key={a.id} className="mb-2 text-sm text-muted">
                  {a.fullName} · {a.line1}, {a.area}, {a.district} {a.postcode}
                </p>
              ))
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
