"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { saveDiscount, deleteDiscount, setDiscountActive } from "@/actions/admin-discounts";
import { LocalDate } from "@/components/admin/LocalDate";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { COUPON_STATUS_LABEL, couponBenefitLabel, type CouponStatus, type CouponType } from "@/lib/coupon-format";
import { formatTaka } from "@/lib/money";

export type CouponUse = {
  id: string;
  amount: number;
  at: string;
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  customerId: string | null;
  customerLabel: string;
};

export type CouponRow = {
  id: string;
  code: string;
  type: CouponType;
  value: number;
  maxDiscountAmount: number | null;
  minSpend: number | null;
  firstOrderOnly: boolean;
  usageLimit: number | null;
  usedCount: number;
  startsAt: string | null;
  endsAt: string | null;
  scope: "GLOBAL" | "PRODUCT";
  active: boolean;
  status: CouponStatus;
  productCount: number;
  totalDeducted: number;
  redemptionCount: number;
  uses: CouponUse[];
};

export function DiscountManager({ coupons, maxUsesListed }: { coupons: CouponRow[]; maxUsesListed: number }) {
  const [editing, setEditing] = useState<CouponRow | "new" | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const live = coupons.filter((c) => c.status === "ACTIVE" || c.status === "SCHEDULED");
  const rest = coupons.filter((c) => c.status !== "ACTIVE" && c.status !== "SCHEDULED");

  function toggleActive(c: CouponRow) {
    setRowError(null);
    startTransition(async () => {
      const res = await setDiscountActive(c.id, !c.active);
      if (!res.ok) setRowError(res.error);
    });
  }

  const section = (title: string, list: CouponRow[], empty: string) => (
    <section className="mt-5">
      <h3 className="font-label mb-2.5 text-[14px] tracking-[1.2px] text-muted">
        {title} <span className="text-muted-2">({list.length})</span>
      </h3>
      {list.length === 0 ? (
        <p className="border border-dashed border-line-2 px-4 py-5 text-center text-sm text-muted-2">{empty}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {list.map((c) => (
            <CouponCard
              key={c.id}
              coupon={c}
              maxUsesListed={maxUsesListed}
              busy={pending}
              onEdit={() => {
                setRowError(null);
                setEditing(c);
              }}
              onToggle={() => toggleActive(c)}
            />
          ))}
        </div>
      )}
    </section>
  );

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] text-muted">
          One coupon per order. A customer can use a code as many times as they like — each coupon just has a shared limit
          across everyone.
        </p>
        <button onClick={() => setEditing("new")} className="btn-primary shrink-0 bg-lime px-4 py-2 font-impact text-sm text-ink">
          + New coupon
        </button>
      </div>

      {editing && (
        <CouponForm
          // Remount per coupon so each open starts from that coupon's own values.
          key={editing === "new" ? "new" : editing.id}
          coupon={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}

      {rowError && <p className="mt-3 text-[13px] text-error">{rowError}</p>}

      {section("ACTIVE & SCHEDULED", live, "No active coupons — create one above.")}
      {rest.length > 0 && section("INACTIVE, EXPIRED & USED UP", rest, "")}
    </div>
  );
}

function CouponCard({
  coupon: c,
  maxUsesListed,
  busy,
  onEdit,
  onToggle,
}: {
  coupon: CouponRow;
  maxUsesListed: number;
  busy: boolean;
  onEdit: () => void;
  onToggle: () => void;
}) {
  const remaining = c.usageLimit != null ? Math.max(c.usageLimit - c.usedCount, 0) : null;
  const rules = [
    c.minSpend != null ? `min spend ${formatTaka(c.minSpend)}` : null,
    c.firstOrderOnly ? "first order only" : null,
  ].filter(Boolean);
  const orphaned = c.scope === "PRODUCT" && c.productCount === 0;

  return (
    <div className="border border-line bg-panel">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-impact text-xl tracking-[1px]">{c.code}</span>
            <StatusBadge status={COUPON_STATUS_LABEL[c.status]} />
            <span className="border border-line-2 px-2 py-0.5 text-[12px] text-muted">
              {c.scope === "GLOBAL"
                ? "Global — all products"
                : `Product-locked · ${c.productCount} ${c.productCount === 1 ? "product" : "products"}`}
            </span>
          </div>
          <p className="mt-1.5 text-sm text-[#ddd]">
            {couponBenefitLabel(c)}
            {rules.length > 0 && <span className="text-muted"> · {rules.join(" · ")}</span>}
          </p>
          {orphaned && (
            <p className="mt-1.5 text-[12px] text-yellow">
              Not attached to any product yet — it can&apos;t be used until you add it in a product&apos;s Coupons section.
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-4 text-[13px]">
          <button onClick={onEdit} className="text-cyan hover:underline">
            Edit
          </button>
          <button onClick={onToggle} disabled={busy} className="text-muted hover:text-paper disabled:opacity-50">
            {c.active ? "Deactivate" : "Activate"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px border-t border-line bg-line desktop:grid-cols-4">
        <Stat label="TIMES USED">
          {c.usedCount}
          {c.usageLimit != null ? <span className="text-muted-2"> / {c.usageLimit}</span> : null}
          <small className="mt-0.5 block text-[12px] font-normal text-muted-2">
            {remaining != null ? `${remaining} left` : "no limit"}
          </small>
        </Stat>
        <Stat label="MONEY DEDUCTED">
          <span className="text-lime">{formatTaka(c.totalDeducted)}</span>
          <small className="mt-0.5 block text-[12px] font-normal text-muted-2">
            {c.type === "FREE_SHIPPING" ? "in delivery charges waived" : "off customers' orders"}
          </small>
        </Stat>
        <Stat label="VALID">
          {c.startsAt || c.endsAt ? (
            <span className="text-[14px]">
              {c.startsAt ? <LocalDate iso={c.startsAt} /> : "Now"} → {c.endsAt ? <LocalDate iso={c.endsAt} /> : "no end"}
            </span>
          ) : (
            "No expiry"
          )}
        </Stat>
        <Stat label="APPLIES TO">
          <span className="text-[14px]">{c.scope === "GLOBAL" ? "Every product" : "Attached products only"}</span>
          <small className="mt-0.5 block text-[12px] font-normal text-muted-2">in-stock &amp; preorder items</small>
        </Stat>
      </div>

      <details className="group border-t border-line">
        <summary className="cursor-pointer select-none px-4 py-2.5 text-sm text-muted hover:text-paper">
          Who used it{" "}
          <span className="text-muted-2">
            ({c.redemptionCount} {c.redemptionCount === 1 ? "order" : "orders"})
          </span>
        </summary>
        {c.uses.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-muted-2">
            No orders have used this coupon yet.
            {c.usedCount > 0 && " (Its use counter predates the order ledger, so those earlier uses aren't itemised.)"}
          </p>
        ) : (
          <div className="overflow-x-auto px-4 pb-4">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-line-2 text-left text-muted">
                  {["Customer", "Order", "Date", c.type === "FREE_SHIPPING" ? "Delivery waived" : "Deducted"].map((h) => (
                    <th key={h} className="font-label pb-2 pr-4 text-[12px] tracking-[0.8px]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {c.uses.map((u) => (
                  <tr key={u.id} className="border-b border-line">
                    <td className="py-2 pr-4">
                      {u.customerId ? (
                        <Link href={`/admin/customers/${u.customerId}`} prefetch={false} className="text-cyan hover:underline">
                          {u.customerLabel}
                        </Link>
                      ) : (
                        <span>
                          {u.customerLabel} <span className="text-[12px] text-muted-2">(guest)</span>
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-4">
                      <Link href={`/admin/orders/${u.orderId}`} prefetch={false} className="text-cyan hover:underline">
                        {u.orderNumber}
                      </Link>{" "}
                      <StatusBadge status={u.orderStatus} />
                    </td>
                    <td className="whitespace-nowrap py-2 pr-4 text-muted"><LocalDate iso={u.at} withTime /></td>
                    <td className="whitespace-nowrap py-2 text-lime">{formatTaka(u.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {c.redemptionCount > c.uses.length && (
              <p className="mt-2 text-[12px] text-muted-2">
                Showing the latest {maxUsesListed} of {c.redemptionCount} orders.
              </p>
            )}
          </div>
        )}
      </details>
    </div>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-panel px-4 py-3">
      <div className="font-label text-[11px] tracking-[1.2px] text-muted-2">{label}</div>
      <div className="mt-1 text-lg font-medium">{children}</div>
    </div>
  );
}

const inputClass = "w-full border border-line-2 bg-ink px-2.5 py-2 text-sm outline-none focus:border-lime";

// <input type="datetime-local"> speaks the admin's *local* wall-clock time, while the database
// stores UTC instants — convert at this boundary so a "ends 10 pm" typed in Dhaka is 10 pm in Dhaka.
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function numOrNull(value: string): number | null {
  const t = value.trim();
  return t === "" || Number.isNaN(Number(t)) ? null : Number(t);
}

function CouponForm({ coupon, onClose }: { coupon: CouponRow | null; onClose: () => void }) {
  const [code, setCode] = useState(coupon?.code ?? "");
  const [type, setType] = useState<CouponType>(coupon?.type ?? "PERCENT");
  const [value, setValue] = useState(coupon ? String(coupon.value) : "10");
  const [cap, setCap] = useState(coupon?.maxDiscountAmount != null ? String(coupon.maxDiscountAmount) : "");
  const [minSpend, setMinSpend] = useState(coupon?.minSpend != null ? String(coupon.minSpend) : "");
  const [limit, setLimit] = useState(coupon?.usageLimit != null ? String(coupon.usageLimit) : "");
  const [limitedTime, setLimitedTime] = useState(Boolean(coupon?.startsAt || coupon?.endsAt));
  const [startsAt, setStartsAt] = useState(toLocalInput(coupon?.startsAt ?? null));
  const [endsAt, setEndsAt] = useState(toLocalInput(coupon?.endsAt ?? null));
  const [scope, setScope] = useState<"GLOBAL" | "PRODUCT">(coupon?.scope ?? "GLOBAL");
  const [firstOrderOnly, setFirstOrderOnly] = useState(coupon?.firstOrderOnly ?? false);
  const [active, setActive] = useState(coupon?.active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const unit = type === "PERCENT" ? "%" : "tk";

  function submit() {
    setError(null);
    if (limitedTime && !endsAt) {
      setError("Pick when this coupon should stop working — or choose “No expiry”.");
      return;
    }
    startTransition(async () => {
      const res = await saveDiscount({
        id: coupon?.id,
        code,
        type,
        value: type === "FREE_SHIPPING" ? 0 : (numOrNull(value) ?? 0),
        maxDiscountAmount: type === "PERCENT" ? numOrNull(cap) : null,
        minSpend: numOrNull(minSpend),
        firstOrderOnly,
        usageLimit: numOrNull(limit),
        startsAt: limitedTime ? fromLocalInput(startsAt) : null,
        endsAt: limitedTime ? fromLocalInput(endsAt) : null,
        scope,
        active,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onClose();
    });
  }

  function remove() {
    if (!coupon || !window.confirm(`Delete coupon ${coupon.code}? This can't be undone.`)) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteDiscount(coupon.id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onClose();
    });
  }

  return (
    <div className="mt-4 border border-line bg-panel-2 p-4.5">
      <h3 className="font-impact mb-3.5 text-[17px] uppercase tracking-[0.5px]">
        {coupon ? `Edit ${coupon.code}` : "New coupon"}
      </h3>

      <div className="grid grid-cols-1 gap-3 desktop:grid-cols-3">
        <Labeled label="Coupon code">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="e.g. WELCOME10"
            className={`${inputClass} uppercase`}
          />
        </Labeled>
        <Labeled label="Discount type">
          <select value={type} onChange={(e) => setType(e.target.value as CouponType)} className={inputClass}>
            <option value="PERCENT">Percentage off</option>
            <option value="FIXED">Amount off (tk)</option>
            <option value="FREE_SHIPPING">Free delivery</option>
          </select>
        </Labeled>
        {type !== "FREE_SHIPPING" && (
          <Labeled label={type === "PERCENT" ? "Percentage" : "Amount"}>
            <div className="flex">
              <input
                type="number"
                min={0}
                step="any"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className={`${inputClass} min-w-0`}
              />
              <span className="grid w-12 shrink-0 place-items-center border border-l-0 border-line-2 bg-panel text-sm text-muted">
                {unit}
              </span>
            </div>
          </Labeled>
        )}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 desktop:grid-cols-3">
        {type === "PERCENT" && (
          <Labeled label="Max discount (tk)" hint="The % discount never takes off more than this. Blank = no ceiling.">
            <div className="flex">
              <input
                type="number"
                min={0}
                step="any"
                value={cap}
                onChange={(e) => setCap(e.target.value)}
                placeholder="No ceiling"
                className={`${inputClass} min-w-0`}
              />
              <span className="grid w-12 shrink-0 place-items-center border border-l-0 border-line-2 bg-panel text-sm text-muted">
                tk
              </span>
            </div>
          </Labeled>
        )}
        <Labeled
          label="Max total uses"
          hint="Across all customers combined — it counts down with every order. Blank = unlimited. One customer can still use it repeatedly."
        >
          <input
            type="number"
            min={1}
            step={1}
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            placeholder="Unlimited"
            className={inputClass}
          />
        </Labeled>
        <Labeled label="Minimum spend (tk)" hint="Optional. Counted on the items the coupon applies to.">
          <input
            type="number"
            min={0}
            step="any"
            value={minSpend}
            onChange={(e) => setMinSpend(e.target.value)}
            placeholder="None"
            className={inputClass}
          />
        </Labeled>
      </div>

      <fieldset className="mt-4">
        <legend className="font-label mb-1.5 text-[13px] tracking-[1.2px] text-muted">TIME LIMIT</legend>
        <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" name="time" checked={!limitedTime} onChange={() => setLimitedTime(false)} className="accent-lime" />
            No expiry (works until switched off)
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="time" checked={limitedTime} onChange={() => setLimitedTime(true)} className="accent-lime" />
            Limited time
          </label>
        </div>
        {limitedTime && (
          <div className="mt-2.5 grid grid-cols-1 gap-3 desktop:grid-cols-3">
            <Labeled label="Starts (optional)">
              <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={inputClass} />
            </Labeled>
            <Labeled label="Ends">
              <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className={inputClass} />
            </Labeled>
          </div>
        )}
      </fieldset>

      <fieldset className="mt-4">
        <legend className="font-label mb-1.5 text-[13px] tracking-[1.2px] text-muted">WHERE IT WORKS</legend>
        <div className="flex flex-col gap-1.5 text-sm">
          <label className="flex items-start gap-2">
            <input type="radio" name="scope" checked={scope === "GLOBAL"} onChange={() => setScope("GLOBAL")} className="mt-1 accent-lime" />
            <span>
              Global <span className="text-muted">— valid on every product, in-stock and preorder alike</span>
            </span>
          </label>
          <label className="flex items-start gap-2">
            <input type="radio" name="scope" checked={scope === "PRODUCT"} onChange={() => setScope("PRODUCT")} className="mt-1 accent-lime" />
            <span>
              Product-locked{" "}
              <span className="text-muted">
                — only on products you attach it to, from the &ldquo;Coupons&rdquo; section of each product&apos;s edit page
              </span>
            </span>
          </label>
        </div>
      </fieldset>

      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1.5 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={firstOrderOnly} onChange={(e) => setFirstOrderOnly(e.target.checked)} className="accent-lime" />
          First order only
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="accent-lime" />
          Active
        </label>
      </div>

      {error && <p className="mt-3 text-[13px] text-error">{error}</p>}

      <div className="mt-4 flex items-center gap-2">
        <button
          disabled={pending}
          onClick={submit}
          className="btn-primary bg-lime px-4 py-2 font-impact text-sm text-ink disabled:opacity-50"
        >
          {coupon ? "Save changes" : "Create coupon"}
        </button>
        <button onClick={onClose} className="border border-line-2 px-4 py-2 text-sm hover:border-lime">
          Cancel
        </button>
        {coupon && (
          <button onClick={remove} disabled={pending} className="ml-auto text-sm text-error hover:underline disabled:opacity-50">
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

function Labeled({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="font-label mb-1 block text-[13px] tracking-[1.2px] text-muted">{label.toUpperCase()}</span>
      {children}
      {hint && <span className="mt-1 block text-[12px] text-muted-2">{hint}</span>}
    </label>
  );
}
