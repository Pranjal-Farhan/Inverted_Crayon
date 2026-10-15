import Link from "next/link";
import { db } from "@/lib/db";
import { formatTaka, toNumber } from "@/lib/money";
import { Panel } from "@/components/admin/Panel";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Avatar } from "@/components/ui/Avatar";
import { parseSearchAmount, parseSearchDateRange } from "@/lib/admin-search";
import type { Prisma } from "@/generated/prisma/client";

type Props = { searchParams: Promise<{ q?: string }> };

const COLUMNS = ["Customer", "Contact", "Location", "Orders", "LTV", "Account"];
const MAX_ROWS = 100;
const MAX_SEARCH_WORDS = 8;

const fmtDate = (d: Date) => d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

// One search word has to match *something* about the customer: their own profile, a saved
// address, or anything on an order they placed (including the products in it). Words are ANDed,
// so "rahim dhaka" finds the Rahim whose address or orders mention Dhaka — typing more narrows.
function wordCondition(word: string): Prisma.CustomerWhereInput {
  const has = { contains: word, mode: "insensitive" as const };
  const any: Prisma.CustomerWhereInput[] = [
    { name: has },
    { email: has },
    { phone: has },
    { notes: has },
    { addresses: { some: { OR: [{ fullName: has }, { phone: has }, { line1: has }, { area: has }, { district: has }, { postcode: has }] } } },
    {
      orders: {
        some: {
          OR: [
            { number: has },
            { email: has },
            { phone: has },
            { discountCode: has },
            { trackingRef: has },
            { shippingFullName: has },
            { shippingPhone: has },
            { shippingLine1: has },
            { shippingArea: has },
            { shippingDistrict: has },
            { items: { some: { productTitleSnapshot: has } } },
          ],
        },
      },
    },
  ];
  const amount = parseSearchAmount(word);
  if (amount != null) any.push({ orders: { some: { total: amount } } });
  const day = parseSearchDateRange(word);
  if (day) any.push({ createdAt: day }, { orders: { some: { createdAt: day } } });
  return { OR: any };
}

function searchWhere(q: string): Prisma.CustomerWhereInput {
  const words = q.split(/\s+/).filter(Boolean).slice(0, MAX_SEARCH_WORDS);
  const alternatives: Prisma.CustomerWhereInput[] = [{ AND: words.map(wordCondition) }];
  // A multi-word date ("Oct 14 2026") would be shredded by the word split above, so the whole
  // phrase also gets one shot at being a date on its own.
  const phraseDay = words.length > 1 ? parseSearchDateRange(q) : null;
  if (phraseDay) alternatives.push({ createdAt: phraseDay }, { orders: { some: { createdAt: phraseDay } } });
  return { OR: alternatives };
}

export default async function AdminCustomersPage({ searchParams }: Props) {
  const { q: rawQ } = await searchParams;
  const q = rawQ?.trim();

  const customers = await db.customer.findMany({
    where: q ? searchWhere(q) : undefined,
    include: {
      orders: {
        select: { id: true, number: true, total: true, status: true, createdAt: true, shippingArea: true, shippingDistrict: true },
        orderBy: { createdAt: "desc" },
      },
      addresses: { orderBy: { isDefault: "desc" }, take: 1 },
      _count: { select: { addresses: true, wishlist: true } },
    },
    orderBy: { createdAt: "desc" },
    take: MAX_ROWS,
  });

  return (
    <div>
      <form className="mb-3 flex flex-wrap items-center gap-2.5" method="get">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search name, email, phone, address, order #, product, amount, date…"
          className="w-full max-w-[560px] border border-line-2 bg-panel px-3 py-2 text-sm outline-none focus:border-lime"
        />
      </form>
      <p className="mb-3.5 text-[13px] text-muted">
        {customers.length} {customers.length === 1 ? "customer" : "customers"}
        {q && (
          <>
            {" "}
            matching &ldquo;{q}&rdquo; ·{" "}
            <Link href="/admin/customers" className="text-cyan hover:underline">
              Clear
            </Link>
          </>
        )}
        {customers.length === MAX_ROWS && ` · showing the ${MAX_ROWS} most recent — narrow the search to find others`}
      </p>

      <Panel className="!p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead>
              <tr className="border-b border-line-2 text-left text-muted">
                {COLUMNS.map((h) => (
                  <th key={h} className="font-label px-3 py-2.5 text-[13px] tracking-[0.8px]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => {
                const href = `/admin/customers/${c.id}`;
                const ltv = c.orders.reduce((s, o) => s + toNumber(o.total), 0);
                const lastOrder = c.orders[0];
                const home = c.addresses[0] ?? null;
                const place = home
                  ? [home.area, home.district].filter(Boolean).join(", ")
                  : lastOrder
                    ? [lastOrder.shippingArea, lastOrder.shippingDistrict].filter(Boolean).join(", ")
                    : "";
                const locked = c.lockedUntil != null && c.lockedUntil > new Date();
                const signIn = [c.passwordHash && "Email", c.googleId && "Google", c.facebookId && "Facebook"].filter(
                  Boolean,
                ) as string[];

                return (
                  <tr key={c.id} className="border-b border-line hover:bg-panel-2/40">
                    <td className="px-3 py-4">
                      <div className="flex items-center gap-3.5">
                        <Link href={href} prefetch={false} aria-label={`Open ${c.name ?? c.email}`}>
                          <Avatar src={c.avatarUrl} name={c.name} email={c.email} size={48} />
                        </Link>
                        <div className="min-w-0">
                          <Link href={href} prefetch={false} className="block max-w-[200px] truncate text-[15px] font-medium hover:text-lime">
                            {c.name ?? "—"}
                          </Link>
                          {locked && (
                            <span className="font-label mt-1 inline-block bg-error/[0.16] px-2 py-0.5 text-[11px] tracking-[0.8px] text-error">
                              LOCKED
                            </span>
                          )}
                          {c.notes && (
                            <div className="mt-0.5 max-w-[200px] truncate text-[12px] italic text-muted-2" title={c.notes}>
                              {c.notes}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="px-3 py-4">
                      <div className="max-w-[220px] truncate" title={c.email}>
                        {c.email}
                      </div>
                      <div className="mt-0.5 text-[12px] text-muted">{c.phone ?? "No phone on file"}</div>
                    </td>

                    <td className="px-3 py-4">
                      {place ? <div>{place}</div> : <span className="text-muted-2">—</span>}
                      <div className="mt-0.5 text-[12px] text-muted-2">
                        {c._count.addresses} saved {c._count.addresses === 1 ? "address" : "addresses"}
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-3 py-4">
                      <div>{c.orders.length}</div>
                      {lastOrder ? (
                        <>
                          <div className="mt-0.5 text-[12px]">
                            <Link href={`/admin/orders/${lastOrder.id}`} prefetch={false} className="text-cyan hover:underline">
                              {lastOrder.number}
                            </Link>{" "}
                            <span className="text-muted-2">· {fmtDate(lastOrder.createdAt)}</span>
                          </div>
                          <div className="mt-1">
                            <StatusBadge status={lastOrder.status} />
                          </div>
                        </>
                      ) : (
                        <div className="mt-0.5 text-[12px] text-muted-2">No orders yet</div>
                      )}
                    </td>

                    <td className="whitespace-nowrap px-3 py-4">
                      <div>{formatTaka(ltv)}</div>
                      {c.orders.length > 0 && (
                        <div className="mt-0.5 text-[12px] text-muted-2">avg {formatTaka(ltv / c.orders.length)}</div>
                      )}
                    </td>

                    <td className="whitespace-nowrap px-3 py-4">
                      <div>Joined {fmtDate(c.createdAt)}</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {signIn.length === 0 ? (
                          <span className="text-[12px] text-muted-2">No sign-in method</span>
                        ) : (
                          signIn.map((m) => (
                            <span key={m} className="border border-line-2 px-1.5 py-0.5 text-[11px] text-muted">
                              {m}
                            </span>
                          ))
                        )}
                      </div>
                      <div className="mt-1 text-[12px] text-muted-2">
                        {c._count.wishlist} wishlisted
                      </div>
                    </td>
                  </tr>
                );
              })}
              {customers.length === 0 && (
                <tr>
                  <td colSpan={COLUMNS.length} className="px-4 py-6 text-center text-muted">
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
