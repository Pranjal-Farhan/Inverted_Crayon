import { requireAdminPage } from "@/lib/admin-guard";
import Link from "next/link";
import { formatTaka, toNumber } from "@/lib/money";
import { Panel } from "@/components/admin/Panel";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Avatar } from "@/components/ui/Avatar";
import { AddressLine, fmtDate, spendSummary } from "@/components/admin/CustomerParts";
import { loadPeople, MAX_PEOPLE, type Person } from "@/lib/admin-customers";
import { splitOrders } from "@/lib/customer-orders";
import { parseVariantLabel } from "@/lib/order-status";

type Props = { searchParams: Promise<{ q?: string; kind?: string }> };

const KINDS = [
  { id: "all", label: "Everyone" },
  { id: "registered", label: "Registered customers" },
  { id: "guest", label: "Guest buyers" },
] as const;

/** One order as a single line: number, status, date, total, and what was in it. */
function OrderLine({ o }: { o: Person["orders"][number] }) {
  const items = o.items
    .map((i) => {
      const v = parseVariantLabel(i.variantLabelSnapshot);
      return `${i.qty}× ${i.productTitleSnapshot} (${v.size}${v.color ? ` / ${v.color}` : ""})`;
    })
    .join(", ");
  return (
    <li className="py-2 text-[13px]">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Link href={`/admin/orders/${o.id}`} prefetch={false} className="font-medium text-cyan hover:underline">
          {o.number}
        </Link>
        <StatusBadge status={o.status} />
        {o.isPreorder && <span className="font-label bg-yellow px-1.5 py-0.5 text-[10px] tracking-[0.8px] text-ink">PREORDER</span>}
        {o.cancellationRequestedAt && <span className="font-label text-[11px] tracking-[0.8px] text-yellow">CANCELLATION REQUESTED</span>}
        {o.customerId == null && <span className="font-label text-[11px] tracking-[0.8px] text-muted-2">GUEST CHECKOUT</span>}
        <span className="text-muted-2">{fmtDate(o.createdAt)}</span>
        <span className="ml-auto text-lime">{formatTaka(toNumber(o.total))}</span>
      </div>
      <div className="mt-0.5 text-[12px] text-muted">{items || "—"}</div>
    </li>
  );
}

function PersonCard({ p }: { p: Person }) {
  const { current, past } = splitOrders(p.orders);
  const { ltv, avg, keptCount } = spendSummary(p.orders);
  const guest = p.kind === "guest";

  return (
    <article className="border border-line bg-panel">
      <div className="grid grid-cols-1 desktop:grid-cols-[minmax(300px,360px)_1fr]">
        {/* ---------------------------------------------------------- personal details */}
        <div className="border-b border-line p-4 desktop:border-b-0 desktop:border-r">
          <div className="flex items-center gap-3.5">
            <Link href={p.href} prefetch={false} aria-label={`Open ${p.name ?? p.email}`}>
              <Avatar src={p.avatarUrl} name={p.name} email={p.email} size={52} />
            </Link>
            <div className="min-w-0">
              <Link href={p.href} prefetch={false} className="block truncate text-[16px] font-medium hover:text-lime">
                {p.name ?? "—"}
              </Link>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <span
                  className={`font-label px-2 py-0.5 text-[11px] tracking-[0.8px] ${guest ? "border border-line-2 text-muted" : "bg-lime/[0.16] text-lime"}`}
                >
                  {guest ? "GUEST — NO ACCOUNT" : "REGISTERED"}
                </span>
                {p.locked && <span className="font-label bg-error/[0.16] px-2 py-0.5 text-[11px] tracking-[0.8px] text-error">LOCKED</span>}
                {p.tags.map((t) => (
                  <span key={t} className="font-label bg-cyan/[0.16] px-2 py-0.5 text-[11px] text-cyan">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <dl className="mt-3 space-y-1.5 text-sm">
            <div className="break-words">
              <span className="text-muted-2">Email </span>
              {p.email}
            </div>
            <div>
              <span className="text-muted-2">{p.phones.length > 1 ? "Phones " : "Phone "}</span>
              {p.phones.length ? p.phones.join(" · ") : "No phone on file"}
            </div>
            <div>
              <span className="text-muted-2">{guest ? "First order " : "Joined "}</span>
              {fmtDate(p.since)}
            </div>
            {!guest && (
              <div>
                <span className="text-muted-2">Signs in with </span>
                {p.signIn.length ? p.signIn.join(", ") : "No sign-in method"}
                {p.wishlistCount > 0 && <span className="text-muted-2"> · {p.wishlistCount} wishlisted</span>}
              </div>
            )}
          </dl>

          <div className="mt-3">
            <div className="font-label text-[12px] tracking-[1px] text-muted-2">
              {p.addressesFromOrders ? (guest ? "ADDRESSES USED ON ORDERS" : "ADDRESSES (FROM ORDERS — NONE SAVED)") : "SAVED ADDRESSES"}
            </div>
            {p.addresses.length === 0 ? (
              <p className="mt-1 text-sm text-muted-2">None.</p>
            ) : (
              <ul className="mt-1 space-y-2 text-[13px] text-muted">
                {p.addresses.map((a, i) => (
                  <li key={i}>
                    <AddressLine a={a} />
                    {a.isDefault && <span className="font-label ml-2 text-[11px] tracking-[0.8px] text-lime">DEFAULT</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {p.notes && (
            <p className="mt-3 border-l-2 border-line-2 pl-2.5 text-[13px] italic text-muted" title="Admin note">
              {p.notes}
            </p>
          )}
          <Link href={p.href} prefetch={false} className="mt-3 inline-block text-[13px] text-cyan hover:underline">
            Open full profile →
          </Link>
        </div>

        {/* ---------------------------------------------------------- orders */}
        <div className="p-4">
          <div className="mb-2.5 flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm">
            <span>
              <span className="text-lg">{p.orders.length}</span> <span className="text-muted">{p.orders.length === 1 ? "order" : "orders"}</span>
            </span>
            <span className="text-muted">
              {current.length} current · {past.length} past
            </span>
            <span>
              Spent <span className="text-lime">{formatTaka(ltv)}</span>
              {keptCount > 0 && <span className="text-[12px] text-muted-2"> · avg {formatTaka(avg)}</span>}
            </span>
          </div>

          <div className="font-label text-[12px] tracking-[1px] text-muted-2">CURRENT ORDERS</div>
          {current.length === 0 ? (
            <p className="py-2 text-[13px] text-muted-2">Nothing in progress.</p>
          ) : (
            <ul className="divide-y divide-line">
              {current.map((o) => (
                <OrderLine key={o.id} o={o} />
              ))}
            </ul>
          )}

          <details className="mt-3 border-t border-line pt-2.5" open={current.length === 0 && past.length > 0 && past.length <= 3}>
            <summary className="font-label cursor-pointer select-none text-[12px] tracking-[1px] text-muted-2 hover:text-paper">
              PAST ORDERS ({past.length})
            </summary>
            {past.length === 0 ? (
              <p className="py-2 text-[13px] text-muted-2">No finished orders yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {past.map((o) => (
                  <OrderLine key={o.id} o={o} />
                ))}
              </ul>
            )}
          </details>
        </div>
      </div>
    </article>
  );
}

export default async function AdminCustomersPage({ searchParams }: Props) {
  await requireAdminPage("customers");
  const { q: rawQ, kind: rawKind } = await searchParams;
  const q = rawQ?.trim();
  const kind = KINDS.some((k) => k.id === rawKind) ? (rawKind as "all" | "registered" | "guest") : "all";

  const { people, registeredTotal, guestTotal, truncated } = await loadPeople(q, kind);
  const tabHref = (k: string) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (k !== "all") sp.set("kind", k);
    const s = sp.toString();
    return `/admin/customers${s ? `?${s}` : ""}`;
  };

  return (
    <div>
      <form className="mb-3 flex flex-wrap items-center gap-2.5" method="get">
        {kind !== "all" && <input type="hidden" name="kind" value={kind} />}
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search name, email, phone, address, order #, product, amount, date…"
          className="w-full max-w-[560px] border border-line-2 bg-panel px-3 py-2 text-sm outline-none focus:border-lime"
        />
      </form>

      <nav className="mb-3 flex flex-wrap gap-1.5" aria-label="Customer type">
        {KINDS.map((k) => (
          <Link
            key={k.id}
            href={tabHref(k.id)}
            className={`border px-3 py-1.5 text-[13px] ${kind === k.id ? "border-lime text-lime" : "border-line-2 text-muted hover:border-lime"}`}
          >
            {k.label}
          </Link>
        ))}
      </nav>

      <p className="mb-3.5 text-[13px] text-muted">
        {kind !== "guest" && (
          <>
            {registeredTotal} registered {registeredTotal === 1 ? "customer" : "customers"}
          </>
        )}
        {kind === "all" && " · "}
        {kind !== "registered" && (
          <>
            {guestTotal} guest {guestTotal === 1 ? "buyer" : "buyers"}
          </>
        )}
        {q && (
          <>
            {" "}
            matching &ldquo;{q}&rdquo; ·{" "}
            <Link href={kind === "all" ? "/admin/customers" : `/admin/customers?kind=${kind}`} className="text-cyan hover:underline">
              Clear
            </Link>
          </>
        )}
        {truncated && ` · showing the ${MAX_PEOPLE} most recently active — narrow the search to find others`}
      </p>

      <div className="space-y-3.5">
        {people.map((p) => (
          <PersonCard key={`${p.kind}:${p.key}`} p={p} />
        ))}
        {people.length === 0 && (
          <Panel>
            <p className="py-4 text-center text-muted">No customers match.</p>
          </Panel>
        )}
      </div>
    </div>
  );
}
