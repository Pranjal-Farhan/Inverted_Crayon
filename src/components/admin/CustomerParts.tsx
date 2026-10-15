import Link from "next/link";
import { formatTaka, toNumber } from "@/lib/money";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { parseVariantLabel } from "@/lib/order-status";
import { splitOrders } from "@/lib/customer-orders";

export const fmtDate = (d: Date) => d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
export const fmtDateTime = (d: Date) =>
  `${fmtDate(d)} · ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;

/** A label/value row for the personal-details blocks. */
export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-x-3 py-1.5 text-sm">
      <dt className="font-label text-[12px] tracking-[1px] text-muted-2">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

export function AddressLine({
  a,
}: {
  a: { fullName: string; phone: string; line1: string; area: string; district: string; postcode: string; country?: string };
}) {
  return (
    <>
      <span className="text-paper">{a.fullName}</span> · {a.phone}
      <br />
      {a.line1}, {a.area}, {a.district} {a.postcode}
      {a.country && a.country !== "Bangladesh" ? `, ${a.country}` : ""}
    </>
  );
}

export type OrderForCard = {
  id: string;
  number: string;
  status: string;
  total: { toString(): string } | number;
  subtotal?: { toString(): string } | number;
  shippingCost?: { toString(): string } | number;
  discountAmount?: { toString(): string } | number;
  discountCode?: string | null;
  createdAt: Date;
  paymentMethod?: string;
  paymentStatus?: string;
  isPreorder?: boolean;
  cancellationRequestedAt?: Date | null;
  shippingFullName?: string;
  shippingPhone?: string;
  shippingLine1?: string;
  shippingArea?: string;
  shippingDistrict?: string;
  shippingPostcode?: string;
  trackingCourier?: string | null;
  trackingRef?: string | null;
  customerId?: string | null;
  items: { id?: string; productId?: string | null; productTitleSnapshot: string; variantLabelSnapshot: string; qty: number; unitPrice?: { toString(): string } | number; lineTotal?: { toString(): string } | number }[];
};

const num = (v: { toString(): string } | number | undefined) => toNumber(v as never);

const PAYMENT_LABEL: Record<string, string> = { COD: "Cash on delivery", BKASH: "bKash", SSLCOMMERZ: "Card / mobile banking" };

/** One order in full: status, every item, money, payment, where it's going. */
export function OrderCard({ order, showGuestTag = false }: { order: OrderForCard; showGuestTag?: boolean }) {
  return (
    <article className="border border-line bg-ink/40 p-3.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <Link href={`/admin/orders/${order.id}`} prefetch={false} className="font-impact text-[15px] text-cyan hover:underline">
          {order.number}
        </Link>
        <StatusBadge status={order.status} />
        {order.isPreorder && <span className="font-label bg-yellow px-2 py-0.5 text-[11px] tracking-[0.8px] text-ink">PREORDER</span>}
        {order.cancellationRequestedAt && (
          <span className="font-label bg-yellow/[0.16] px-2 py-0.5 text-[11px] tracking-[0.8px] text-yellow">CANCELLATION REQUESTED</span>
        )}
        {showGuestTag && order.customerId == null && (
          <span className="font-label border border-line-2 px-2 py-0.5 text-[11px] tracking-[0.8px] text-muted">GUEST CHECKOUT</span>
        )}
        <span className="ml-auto text-[12px] text-muted-2">{fmtDateTime(order.createdAt)}</span>
      </div>

      <ul className="mt-2.5 divide-y divide-line text-sm">
        {order.items.map((i, idx) => {
          const v = parseVariantLabel(i.variantLabelSnapshot);
          return (
            <li key={i.id ?? idx} className="flex flex-wrap items-baseline gap-x-3 py-1.5">
              <span className="min-w-0 flex-1">
                {i.productId ? (
                  <Link href={`/admin/products/${i.productId}`} prefetch={false} className="hover:text-lime">
                    {i.productTitleSnapshot}
                  </Link>
                ) : (
                  i.productTitleSnapshot
                )}
                <span className="ml-2 text-[12px] text-muted">
                  {v.size}
                  {v.color ? ` · ${v.color}` : ""}
                </span>
              </span>
              <span className="text-muted">×{i.qty}</span>
              {i.lineTotal !== undefined && <span className="w-24 text-right">{formatTaka(num(i.lineTotal))}</span>}
            </li>
          );
        })}
      </ul>

      <div className="mt-2 flex flex-wrap items-baseline gap-x-5 gap-y-1 border-t border-line pt-2 text-[13px]">
        {order.subtotal !== undefined && <span className="text-muted">Items {formatTaka(num(order.subtotal))}</span>}
        {order.discountAmount !== undefined && num(order.discountAmount) > 0 && (
          <span className="text-muted">
            Discount −{formatTaka(num(order.discountAmount))}
            {order.discountCode ? ` (${order.discountCode})` : ""}
          </span>
        )}
        {order.shippingCost !== undefined && <span className="text-muted">Delivery {formatTaka(num(order.shippingCost))}</span>}
        <span className="ml-auto text-[15px] text-lime">{formatTaka(num(order.total))}</span>
      </div>

      <div className="mt-1.5 text-[12px] text-muted-2">
        {order.paymentMethod && (
          <span>
            {PAYMENT_LABEL[order.paymentMethod] ?? order.paymentMethod}
            {order.paymentStatus ? ` · ${order.paymentStatus.toLowerCase()}` : ""}
          </span>
        )}
        {order.shippingFullName && (
          <span>
            {order.paymentMethod ? " · " : ""}
            Deliver to {order.shippingFullName}, {order.shippingPhone}, {order.shippingLine1}, {order.shippingArea}, {order.shippingDistrict} {order.shippingPostcode}
          </span>
        )}
        {order.trackingCourier && (
          <span>
            {" · "}
            {order.trackingCourier} · ref {order.trackingRef ?? "—"}
          </span>
        )}
      </div>
    </article>
  );
}

/** "Current orders" (still in motion) and "Past orders" (finished), each with every order in full. */
export function OrdersSections({ orders, showGuestTag = false }: { orders: OrderForCard[]; showGuestTag?: boolean }) {
  const { current, past } = splitOrders(orders);
  return (
    <div className="space-y-4.5">
      <section>
        <h3 className="font-impact mb-2.5 text-[17px] uppercase tracking-[0.5px]">
          Current orders <span className="ml-1 text-sm text-muted">({current.length})</span>
        </h3>
        {current.length === 0 ? (
          <p className="text-sm text-muted">Nothing in progress right now.</p>
        ) : (
          <div className="space-y-2.5">
            {current.map((o) => (
              <OrderCard key={o.id} order={o} showGuestTag={showGuestTag} />
            ))}
          </div>
        )}
      </section>
      <section>
        <h3 className="font-impact mb-2.5 text-[17px] uppercase tracking-[0.5px]">
          Past orders <span className="ml-1 text-sm text-muted">({past.length})</span>
        </h3>
        {past.length === 0 ? (
          <p className="text-sm text-muted">No finished orders yet.</p>
        ) : (
          <div className="space-y-2.5">
            {past.map((o) => (
              <OrderCard key={o.id} order={o} showGuestTag={showGuestTag} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/** The money summary used at the top of a person's page. */
export function spendSummary(orders: { total: { toString(): string } | number; status: string }[]) {
  // Refunded/cancelled orders aren't money the store kept.
  const kept = orders.filter((o) => o.status !== "CANCELLED" && o.status !== "REFUNDED");
  const ltv = kept.reduce((s, o) => s + num(o.total), 0);
  return { ltv, avg: kept.length ? ltv / kept.length : 0, keptCount: kept.length };
}
