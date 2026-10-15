import { requireAdminPage } from "@/lib/admin-guard";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { formatTaka } from "@/lib/money";
import { Panel } from "@/components/admin/Panel";
import { Avatar } from "@/components/ui/Avatar";
import { AddressLine, Field, OrdersSections, fmtDate, spendSummary } from "@/components/admin/CustomerParts";
import { distinctPhones, distinctShipTo, splitOrders } from "@/lib/customer-orders";

type Props = { params: Promise<{ email: string }> };

function decodeEmail(raw: string): string {
  try {
    return decodeURIComponent(raw).trim();
  } catch {
    return raw.trim();
  }
}

/**
 * Someone who checked out as a guest — no account, so there is no profile to read from. Everything
 * here is what they typed at checkout, gathered from all the orders placed with their email.
 */
export default async function AdminGuestDetailPage({ params }: Props) {
  await requireAdminPage("customers");
  const email = decodeEmail((await params).email);

  const orders = await db.order.findMany({
    where: { customerId: null, email: { equals: email, mode: "insensitive" } },
    orderBy: { createdAt: "desc" },
    include: { items: true },
  });
  if (orders.length === 0) notFound();

  // If they have since made an account with this email, the full profile lives there.
  const account = await db.customer.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } });
  if (account) redirect(`/admin/customers/${account.id}`);

  const latest = orders[0];
  const first = orders[orders.length - 1];
  const { current, past } = splitOrders(orders);
  const { ltv, avg, keptCount } = spendSummary(orders);
  const phones = distinctPhones(orders.flatMap((o) => [o.phone, o.shippingPhone]));
  const names = [...new Set(orders.map((o) => o.shippingFullName.trim()))];
  const addresses = distinctShipTo(orders);

  return (
    <div>
      <Link href="/admin/customers?kind=guest" className="text-cyan mb-3 inline-block text-sm">
        ← Guest buyers
      </Link>

      <div className="mb-4.5 flex flex-wrap items-center gap-4 border border-line bg-panel p-4">
        <Avatar name={latest.shippingFullName} email={latest.email} size={64} />
        <div className="min-w-0 flex-1">
          <h2 className="font-impact truncate text-[22px] uppercase tracking-[0.5px]">{latest.shippingFullName}</h2>
          <div className="mt-1">
            <span className="font-label border border-line-2 px-2 py-0.5 text-[11px] tracking-[0.8px] text-muted">GUEST — NO ACCOUNT</span>
          </div>
        </div>
        <dl className="flex gap-6 text-sm">
          <div>
            <dt className="font-label text-[11px] tracking-[1px] text-muted-2">ORDERS</dt>
            <dd className="text-lg">
              {orders.length} <span className="text-[12px] text-muted">({current.length} current · {past.length} past)</span>
            </dd>
          </div>
          <div>
            <dt className="font-label text-[11px] tracking-[1px] text-muted-2">SPENT</dt>
            <dd className="text-lg text-lime">{formatTaka(ltv)}</dd>
          </div>
          <div>
            <dt className="font-label text-[11px] tracking-[1px] text-muted-2">AVERAGE ORDER</dt>
            <dd className="text-lg">{keptCount ? formatTaka(avg) : "—"}</dd>
          </div>
        </dl>
      </div>

      <div className="grid grid-cols-1 gap-4.5 desktop:grid-cols-[1.6fr_1fr]">
        <Panel title="Orders">
          <OrdersSections orders={orders} />
        </Panel>

        <div className="space-y-4.5">
          <Panel title="Personal details (as typed at checkout)">
            <dl>
              <Field label={names.length > 1 ? "NAMES" : "NAME"}>{names.join(" · ")}</Field>
              <Field label="EMAIL">{latest.email}</Field>
              <Field label={phones.length > 1 ? "PHONES" : "PHONE"}>
                {phones.length ? (
                  <ul>
                    {phones.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                ) : (
                  "—"
                )}
              </Field>
              <Field label="FIRST ORDER">{fmtDate(first.createdAt)}</Field>
              <Field label="LAST ORDER">{fmtDate(latest.createdAt)}</Field>
              <Field label="ACCOUNT">No account — has only ever checked out as a guest.</Field>
            </dl>
          </Panel>

          <Panel title={`Addresses used (${addresses.length})`}>
            <ul className="space-y-2.5 text-sm text-muted">
              {addresses.map((a, i) => (
                <li key={i}>
                  <AddressLine a={a} />
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
