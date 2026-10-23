"use client";

import { useMemo, useState, useTransition } from "react";
import { saveRecordedSale } from "@/actions/admin-sales";
import { formatTakaPrecise } from "@/lib/money";
import type { VariantOption } from "@/lib/variant-options";
import { ProductPicker } from "@/components/admin/finance/ProductPicker";
import { Field, METHOD_OPTIONS, btnGhost, btnPrimary, inputCls } from "@/components/admin/finance/ui";
import { attempt } from "@/lib/attempt";

export type RecordedSaleInitial = {
  id: string;
  number: string;
  date: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerAddress: string;
  method: string;
  paymentReceived: boolean;
  /** Shown read-only when editing — a sale's status moves from its Orders page. */
  statusLabel: string;
  discount: number;
  deliveryCharge: number;
  notes: string;
  items: { variantId: string | null; label: string; qty: number; unitPrice: number }[];
};

type ItemState = { uid: number; variantId: string; qty: string; unitPrice: string };
let uidCounter = 1;
const blankItem = (): ItemState => ({ uid: uidCounter++, variantId: "", qty: "1", unitPrice: "" });

const STATUS_CHOICES = [
  ["DELIVERED", "Delivered"],
  ["SHIPPED", "Sent For Delivery"],
  ["PENDING", "Not Cleared Yet"],
] as const;

/**
 * The "record a sale" form — one component for recording and for editing, used on the Sales page
 * and on a recorded sale's own order page. Products are catalogue products only (so stock and
 * buying cost are always known) and the box finds them by ANY detail: name, SKU, size, colour,
 * category, price… The server decides whether there is enough stock and says so in words.
 */
export function RecordSaleForm({
  initial,
  variants,
  today,
  onDone,
}: {
  initial?: RecordedSaleInitial;
  variants: VariantOption[];
  today: string;
  /** Called after a successful save (with the order's id), so the parent can reset or close. */
  onDone: (orderId: string) => void;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [items, setItems] = useState<ItemState[]>(() =>
    initial && initial.items.length > 0
      ? initial.items.map((i) => ({ uid: uidCounter++, variantId: i.variantId ?? "", qty: String(i.qty), unitPrice: String(i.unitPrice) }))
      : [blankItem()],
  );
  const [discount, setDiscount] = useState(String(initial?.discount || ""));
  const [delivery, setDelivery] = useState(String(initial?.deliveryCharge || ""));

  const byId = useMemo(() => new Map(variants.map((v) => [v.id, v])), [variants]);
  const pickerOptions = useMemo(
    () => variants.map((v) => ({ id: v.id, label: v.label, sub: v.sub, search: v.search, hint: v.stock > 0 ? `${v.stock} in stock` : "out of stock", dim: v.stock <= 0 })),
    [variants],
  );
  // A line whose product isn't in the catalogue any more (an old sale) keeps its text but can't be re-picked.
  const orphanLabels = useMemo(() => new Map((initial?.items ?? []).map((i, n) => [n, i.label])), [initial]);

  const subtotal = items.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.unitPrice) || 0), 0);
  const total = Math.max(0, subtotal - (Number(discount) || 0) + (Number(delivery) || 0));
  const patch = (uid: number, p: Partial<ItemState>) => setItems((list) => list.map((i) => (i.uid === uid ? { ...i, ...p } : i)));

  function pick(uid: number, variantId: string) {
    const v = byId.get(variantId);
    patch(uid, v ? { variantId, unitPrice: String(v.price) } : { variantId: "" });
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    if (items.some((i) => !i.variantId)) {
      setError("Choose a product for every line (search by name, SKU, size, colour…).");
      return;
    }
    form.set("items", JSON.stringify(items.map((i) => ({ variantId: i.variantId, qty: i.qty, unitPrice: i.unitPrice || 0 }))));
    setError("");
    start(async () => {
      const r = await attempt(() => saveRecordedSale(null, form));
      if (!r.ok) return setError(r.error);
      onDone(r.orderId ?? "");
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {initial && <input type="hidden" name="id" value={initial.id} />}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 desktop:grid-cols-4">
        <Field label="SALE DATE">
          <input type="date" name="date" required defaultValue={initial?.date ?? today} className={inputCls} />
        </Field>
        <Field label="CUSTOMER NAME">
          <input name="customerName" required maxLength={120} defaultValue={initial?.customerName} placeholder="Full name" className={inputCls} />
        </Field>
        <Field label="PHONE">
          <input name="customerPhone" maxLength={40} defaultValue={initial?.customerPhone} placeholder="01XXXXXXXXX" className={inputCls} />
        </Field>
        <Field label="EMAIL (OPTIONAL)">
          <input name="customerEmail" type="email" maxLength={160} defaultValue={initial?.customerEmail} className={inputCls} />
        </Field>
        <Field label="ADDRESS (OPTIONAL)" className="sm:col-span-2 desktop:col-span-4">
          <input name="customerAddress" maxLength={300} defaultValue={initial?.customerAddress} placeholder="House, road, area, district" className={inputCls} />
        </Field>
      </div>

      <div>
        <div className="font-label mb-1.5 text-[12px] tracking-[1px] text-muted">PRODUCTS SOLD</div>
        <div className="space-y-2.5">
          {items.map((it, idx) => {
            const v = byId.get(it.variantId);
            const qty = Number(it.qty) || 0;
            return (
              <div key={it.uid} className="border border-line bg-ink/40 p-3">
                <div className="grid grid-cols-2 gap-2.5 desktop:grid-cols-[minmax(0,3fr)_80px_130px_auto]">
                  <ProductPicker
                    className="col-span-2 desktop:col-span-1"
                    ariaLabel={`Product ${idx + 1}: search by name, SKU, size, colour, category or price`}
                    placeholder="Search by name, SKU, size, colour, category, price…"
                    options={pickerOptions}
                    value={it.variantId}
                    onChange={(id) => pick(it.uid, id)}
                  />
                  <input type="number" min={1} step={1} value={it.qty} onChange={(e) => patch(it.uid, { qty: e.target.value })} aria-label={`Product ${idx + 1} quantity`} placeholder="Qty" required className={inputCls} />
                  <input type="number" min={0} step="0.01" inputMode="decimal" value={it.unitPrice} onChange={(e) => patch(it.uid, { unitPrice: e.target.value })} aria-label={`Product ${idx + 1} price each`} placeholder="Price each ৳" required className={inputCls} />
                  <button type="button" disabled={items.length === 1} onClick={() => setItems((l) => l.filter((x) => x.uid !== it.uid))} className={btnGhost} aria-label={`Remove product ${idx + 1}`}>
                    Remove
                  </button>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted">
                  {v ? (
                    <span className={qty > v.stock && !initial ? "text-error" : ""}>
                      {v.stock} in stock now{qty > v.stock && !initial ? ` — only ${v.stock} available, this line wants ${qty}` : ""} · {v.sku}
                    </span>
                  ) : orphanLabels.get(idx) ? (
                    <span className="text-error">{orphanLabels.get(idx)} is no longer in the catalogue — choose a product.</span>
                  ) : (
                    <span>Pick a product — its stock is taken off the shelf when the sale is saved.</span>
                  )}
                  <span className="ml-auto text-paper">Line: {formatTakaPrecise(qty * (Number(it.unitPrice) || 0))}</span>
                </div>
              </div>
            );
          })}
        </div>
        <button type="button" onClick={() => setItems((l) => [...l, blankItem()])} className={`${btnGhost} mt-2.5`}>
          + Add another product
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 desktop:grid-cols-4">
        <Field label="DISCOUNT GIVEN (৳)">
          <input type="number" name="discount" min="0" step="0.01" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" className={inputCls} />
        </Field>
        <Field label="DELIVERY CHARGED (৳)">
          <input type="number" name="deliveryCharge" min="0" step="0.01" inputMode="decimal" value={delivery} onChange={(e) => setDelivery(e.target.value)} placeholder="0" className={inputCls} />
        </Field>
        <Field label="PAID VIA">
          <select name="method" defaultValue={initial?.method ?? "CASH"} className={inputCls}>
            {METHOD_OPTIONS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        {initial ? (
          <Field label="STATUS">
            <div className="border border-line-2 bg-ink/40 px-2.5 py-2 text-sm text-muted" title="Change a sale's status from its order page">
              {initial.statusLabel}
            </div>
          </Field>
        ) : (
          <Field label="STATUS">
            <select name="status" defaultValue="DELIVERED" className={inputCls}>
              {STATUS_CHOICES.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
        )}
        <label className="flex items-center gap-2 text-sm sm:col-span-2 desktop:col-span-4">
          <input type="checkbox" name="paymentReceived" defaultChecked={initial ? initial.paymentReceived : true} /> Payment received
          <span className="text-[12px] text-muted">(untick if they still owe it — a sale counts in Total Sales once it is Delivered or paid)</span>
        </label>
        <Field label="NOTES (OPTIONAL)" className="sm:col-span-2 desktop:col-span-4">
          <input name="notes" maxLength={500} defaultValue={initial?.notes} className={inputCls} />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-3.5">
        <button type="submit" disabled={pending} className={btnPrimary}>
          {pending ? "Saving…" : initial ? "Save changes" : "Record sale"}
        </button>
        {initial && (
          <button type="button" onClick={() => onDone("")} className={btnGhost}>
            Cancel
          </button>
        )}
        <span className="ml-auto text-sm">
          Products {formatTakaPrecise(subtotal)}
          {Number(discount) > 0 && <> − discount {formatTakaPrecise(Number(discount))}</>}
          {Number(delivery) > 0 && <> + delivery {formatTakaPrecise(Number(delivery))}</>} = <span className="font-impact text-lg text-lime">{formatTakaPrecise(total)}</span>
        </span>
        {error && (
          <p role="alert" className="w-full text-[13px] text-error">
            {error}
          </p>
        )}
      </div>
    </form>
  );
}
