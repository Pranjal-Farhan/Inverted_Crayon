import Link from "next/link";
import { db } from "@/lib/db";
import { formatTaka, toNumber } from "@/lib/money";
import { Panel } from "@/components/admin/Panel";

type Props = { searchParams: Promise<{ q?: string; segment?: string }> };

export default async function AdminCustomersPage({ searchParams }: Props) {
  const { q, segment } = await searchParams;

  const customers = await db.customer.findMany({
    where: {
      OR: q ? [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] : undefined,
      segmentTags: segment ? { has: segment } : undefined,
    },
    include: { orders: { select: { total: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div>
      <form className="mb-3.5 flex flex-wrap items-center gap-2.5" method="get">
        <input name="q" defaultValue={q} placeholder="Search customers…" className="border border-line-2 bg-panel px-2.5 py-2 text-sm outline-none focus:border-lime" />
        <select name="segment" defaultValue={segment ?? ""} className="border border-line-2 bg-panel px-2.5 py-2 text-sm">
          <option value="">All segments</option>
          <option value="VIP">VIP</option>
          <option value="Repeat">Repeat</option>
          <option value="New">New</option>
        </select>
        <button type="submit" className="border border-line-2 px-3 py-2 text-sm hover:border-lime">
          Filter
        </button>
      </form>

      <Panel className="!p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line-2 text-left text-muted">
              {["Customer", "Email", "Orders", "LTV", "Segment"].map((h) => (
                <th key={h} className="font-label px-4 py-2.5 text-[13px] tracking-[0.8px]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => {
              const ltv = c.orders.reduce((s, o) => s + toNumber(o.total), 0);
              return (
                <tr key={c.id} className="border-b border-line">
                  <td className="px-4 py-2.5">
                    <Link href={`/admin/customers/${c.id}`} className="hover:text-lime">
                      {c.name ?? "—"}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">{c.email}</td>
                  <td className="px-4 py-2.5">{c.orders.length}</td>
                  <td className="px-4 py-2.5">{formatTaka(ltv)}</td>
                  <td className="px-4 py-2.5">
                    <span className="font-label bg-cyan/[0.16] px-2.5 py-0.5 text-[12px] tracking-[0.8px] text-cyan">
                      {c.segmentTags[0] ?? "—"}
                    </span>
                  </td>
                </tr>
              );
            })}
            {customers.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted">
                  No customers match.
                </td>
              </tr>
            )}
          </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
