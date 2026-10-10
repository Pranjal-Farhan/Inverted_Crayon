import Link from "next/link";
import { db } from "@/lib/db";
import { formatTaka, toNumber } from "@/lib/money";
import { Panel } from "@/components/admin/Panel";
import { Avatar } from "@/components/ui/Avatar";
import { AutoSubmitSelect } from "@/components/admin/AutoSubmitSelect";
import { parseSearchAmount, parseSearchDateRange } from "@/lib/admin-search";
import type { Prisma } from "@/generated/prisma/client";

type Props = { searchParams: Promise<{ q?: string; segment?: string }> };

export default async function AdminCustomersPage({ searchParams }: Props) {
  const { q: rawQ, segment } = await searchParams;
  const q = rawQ?.trim();

  const searchConditions: Prisma.CustomerWhereInput[] = [];
  if (q) {
    searchConditions.push(
      { name: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { phone: { contains: q, mode: "insensitive" } },
      // Also match a customer by an order they placed — order number or amount, searched from
      // the Customers page should find "who placed order #1234", not just literal name/email/phone.
      { orders: { some: { number: { contains: q, mode: "insensitive" } } } },
    );
    const amount = parseSearchAmount(q);
    if (amount != null) searchConditions.push({ orders: { some: { total: amount } } });
    const dateRange = parseSearchDateRange(q);
    if (dateRange) searchConditions.push({ createdAt: dateRange }, { orders: { some: { createdAt: dateRange } } });
  }

  const customers = await db.customer.findMany({
    where: {
      OR: searchConditions.length > 0 ? searchConditions : undefined,
      segmentTags: segment ? { has: segment } : undefined,
    },
    include: { orders: { select: { total: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div>
      <form className="mb-3.5 flex flex-wrap items-center gap-2.5" method="get">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search name, email, phone, order #, amount, date…"
          className="min-w-[280px] border border-line-2 bg-panel px-2.5 py-2 text-sm outline-none focus:border-lime"
        />
        <AutoSubmitSelect name="segment" defaultValue={segment ?? ""} className="border border-line-2 bg-panel px-2.5 py-2 text-sm">
          <option value="">All segments</option>
          <option value="VIP">VIP</option>
          <option value="Repeat">Repeat</option>
          <option value="New">New</option>
        </AutoSubmitSelect>
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
                    <Link href={`/admin/customers/${c.id}`} className="flex items-center gap-2.5 hover:text-lime">
                      <Avatar src={c.avatarUrl} name={c.name} email={c.email} size={26} />
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
