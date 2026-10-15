import { requireAdminPage } from "@/lib/admin-guard";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatTaka } from "@/lib/money";
import { Panel } from "@/components/admin/Panel";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Avatar } from "@/components/ui/Avatar";
import { AddressLine, Field, OrdersSections, fmtDate, fmtDateTime, spendSummary } from "@/components/admin/CustomerParts";
import { distinctPhones, distinctShipTo, splitOrders } from "@/lib/customer-orders";
import { parseVariantLabel } from "@/lib/order-status";

type Props = { params: Promise<{ id: string }> };

export default async function AdminCustomerDetailPage({ params }: Props) {
  await requireAdminPage("customers");
  const { id } = await params;
  const customer = await db.customer.findUnique({
    where: { id },
    include: {
      orders: { orderBy: { createdAt: "desc" }, include: { items: true } },
      addresses: { orderBy: { isDefault: "desc" } },
      wishlist: { include: { product: { select: { id: true, title: true, slug: true } } }, orderBy: { createdAt: "desc" } },
      backInStockSubs: { include: { variant: { include: { product: { select: { id: true, title: true } } } } }, orderBy: { createdAt: "desc" } },
      returns: { include: { order: { select: { id: true, number: true } }, items: { include: { orderItem: { select: { productTitleSnapshot: true, variantLabelSnapshot: true } } } } }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!customer) notFound();

  // Orders this person placed with the same email while logged out are not linked to the account in
  // the database — they're still theirs, so they're shown here too (tagged "guest checkout").
  const guestOrders = await db.order.findMany({
    where: { customerId: null, email: { equals: customer.email, mode: "insensitive" } },
    orderBy: { createdAt: "desc" },
    include: { items: true },
  });
  const orders = [...customer.orders, ...guestOrders].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const { current, past } = splitOrders(orders);
  const { ltv, avg, keptCount } = spendSummary(orders);

  const phones = distinctPhones([customer.phone, ...customer.addresses.map((a) => a.phone), ...orders.flatMap((o) => [o.phone, o.shippingPhone])]);
  const orderAddresses = distinctShipTo(orders);
  const locked = customer.lockedUntil != null && customer.lockedUntil > new Date();
  const signIn = [customer.passwordHash && "Email & password", customer.googleId && "Google"].filter(Boolean) as string[];
  const first = orders[orders.length - 1];

  return (
    <div>
      <Link href="/admin/customers" className="text-cyan mb-3 inline-block text-sm">
        ← Customers
      </Link>

      <div className="mb-4.5 flex flex-wrap items-center gap-4 border border-line bg-panel p-4">
        <Avatar src={customer.avatarUrl} name={customer.name} email={customer.email} size={64} />
        <div className="min-w-0 flex-1">
          <h2 className="font-impact truncate text-[22px] uppercase tracking-[0.5px]">{customer.name ?? customer.email}</h2>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <span className="font-label bg-lime/[0.16] px-2 py-0.5 text-[11px] tracking-[0.8px] text-lime">REGISTERED</span>
            {locked && <span className="font-label bg-error/[0.16] px-2 py-0.5 text-[11px] tracking-[0.8px] text-error">LOCKED</span>}
            {customer.segmentTags.map((t) => (
              <span key={t} className="font-label bg-cyan/[0.16] px-2 py-0.5 text-[11px] text-cyan">
                {t}
              </span>
            ))}
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
          <OrdersSections orders={orders} showGuestTag />
        </Panel>

        <div className="space-y-4.5">
          <Panel title="Personal details">
            <dl>
              <Field label="NAME">{customer.name ?? "—"}</Field>
              <Field label="EMAIL">{customer.email}</Field>
              <Field label={phones.length > 1 ? "PHONES" : "PHONE"}>
                {phones.length ? (
                  <ul>
                    {phones.map((p) => (
                      <li key={p}>
                        {p}
                        {p === customer.phone && <span className="ml-2 text-[11px] text-muted-2">on profile</span>}
                      </li>
                    ))}
                  </ul>
                ) : (
                  "No phone on file"
                )}
              </Field>
              <Field label="JOINED">{fmtDateTime(customer.createdAt)}</Field>
              <Field label="FIRST ORDER">{first ? fmtDate(first.createdAt) : "—"}</Field>
              <Field label="SIGNS IN WITH">{signIn.length ? signIn.join(", ") : "No sign-in method"}</Field>
              <Field label="ACCOUNT">
                {locked ? `Locked until ${fmtDateTime(customer.lockedUntil!)}` : "Active"}
                {customer.failedLoginCount > 0 && <span className="text-muted-2"> · {customer.failedLoginCount} failed sign-in attempts</span>}
              </Field>
              <Field label="NOTES">{customer.notes ? <span className="italic text-muted">{customer.notes}</span> : <span className="text-muted-2">None</span>}</Field>
            </dl>
          </Panel>

          <Panel title={`Saved addresses (${customer.addresses.length})`}>
            {customer.addresses.length === 0 ? (
              <p className="text-sm text-muted">No saved addresses.</p>
            ) : (
              <ul className="space-y-2.5 text-sm text-muted">
                {customer.addresses.map((a) => (
                  <li key={a.id}>
                    <AddressLine a={a} />
                    {a.isDefault && <span className="font-label ml-2 text-[11px] tracking-[0.8px] text-lime">DEFAULT</span>}
                  </li>
                ))}
              </ul>
            )}
            {orderAddresses.length > 0 && (
              <>
                <div className="font-label mb-1.5 mt-4 text-[12px] tracking-[1px] text-muted-2">ADDRESSES USED ON ORDERS</div>
                <ul className="space-y-2.5 text-[13px] text-muted">
                  {orderAddresses.map((a, i) => (
                    <li key={i}>
                      <AddressLine a={a} />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Panel>

          <Panel title={`Wishlist (${customer.wishlist.length})`}>
            {customer.wishlist.length === 0 ? (
              <p className="text-sm text-muted">Nothing wishlisted.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {customer.wishlist.map((w) => (
                  <li key={w.id}>
                    <Link href={`/admin/products/${w.product.id}`} prefetch={false} className="hover:text-lime">
                      {w.product.title}
                    </Link>
                    <span className="ml-2 text-[12px] text-muted-2">added {fmtDate(w.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {customer.backInStockSubs.length > 0 && (
            <Panel title={`Waiting for restock (${customer.backInStockSubs.length})`}>
              <ul className="space-y-1 text-sm">
                {customer.backInStockSubs.map((s) => {
                  const v = parseVariantLabel(`${s.variant.size} / ${s.variant.color}`);
                  return (
                    <li key={s.id}>
                      {s.variant.product.title}
                      <span className="ml-2 text-[12px] text-muted">
                        {v.size}
                        {v.color ? ` · ${v.color}` : ""}
                      </span>
                      <span className="ml-2 text-[12px] text-muted-2">{s.notifiedAt ? "told it's back" : "not back yet"}</span>
                    </li>
                  );
                })}
              </ul>
            </Panel>
          )}

          {customer.returns.length > 0 && (
            <Panel title={`Returns (${customer.returns.length})`}>
              <ul className="space-y-3 text-sm">
                {customer.returns.map((r) => (
                  <li key={r.id}>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/admin/orders/${r.order.id}`} prefetch={false} className="text-cyan hover:underline">
                        {r.order.number}
                      </Link>
                      <StatusBadge status={r.status} />
                      <span className="text-[12px] text-muted-2">{fmtDate(r.createdAt)}</span>
                    </div>
                    <div className="mt-0.5 text-[13px] text-muted">
                      {r.items.map((i) => `${i.qty}× ${i.orderItem.productTitleSnapshot} (${i.orderItem.variantLabelSnapshot})`).join(", ")}
                    </div>
                    <div className="text-[12px] italic text-muted-2">&ldquo;{r.reason}&rdquo;</div>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
