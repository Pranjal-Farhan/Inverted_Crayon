"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { saveManualSale, deleteManualSale, deleteManualSales, markCashCollected, undoCashCollected, setOrdersExcludedFromFinance } from "@/actions/admin-finance";
import { Panel } from "@/components/admin/Panel";
import { formatTakaPrecise } from "@/lib/money";
import { useServerForm } from "./useServerForm";
import { ProductPicker } from "./ProductPicker";
import { BulkBar, RowCheck, useSelection } from "./selection";
import { Field, Money, EmptyRow, RowActions, SaleStatusChip, METHOD_OPTIONS, inputCls, btnGhost, btnPrimary, btnDanger } from "./ui-client";

export type SaleListRow = {
  key: string;
  source: "ORDER" | "MANUAL";
  id: string;
  ref: string;
  href: string;
  date: string;
  customerName: string;
  customerPhone: string | null;
  itemsSummary: string;
  status: string;
  statusLabel: string;
  paymentLabel: string;
  revenue: number;
  cogs: number;
  profit: number;
  unknownCostUnits: number;
  /** COLLECTED / AWAITING / NONE — where the sale's money is. */
  cashStatus: string;
  /** The day it was collected, "14 Oct 2026". */
  cashOn: string;
  /** True when the collection was marked by hand (so it can be undone). */
  canUndoCash: boolean;
  /** An online order taken out of the finance reports. */
  removed: boolean;
};

export type VariantOption = { id: string; label: string; sku: string; price: number; cost: number | null; stock: number };

export type ManualSaleInitial = {
  id: string;
  number: string;
  date: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerAddress: string;
  method: string;
  paid: boolean;
  discount: number;
  deliveryCharge: number;
  notes: string;
  items: { description: string; variantId: string | null; qty: number; unitPrice: number; unitCost: string; deduct: boolean }[];
};

type ItemState = { uid: number; description: string; variantId: string; qty: string; unitPrice: string; unitCost: string; deduct: boolean };

let uidCounter = 1;
const blankItem = (): ItemState => ({ uid: uidCounter++, description: "", variantId: "", qty: "1", unitPrice: "", unitCost: "", deduct: false });

function ManualSaleForm({ initial, variants, today, onDone }: { initial?: ManualSaleInitial; variants: VariantOption[]; today: string; onDone: () => void }) {
  const { state, pending, onSubmit } = useServerForm(saveManualSale, onDone);
  const [items, setItems] = useState<ItemState[]>(() =>
    initial
      ? initial.items.map((i) => ({ uid: uidCounter++, description: i.description, variantId: i.variantId ?? "", qty: String(i.qty), unitPrice: String(i.unitPrice), unitCost: i.unitCost, deduct: i.deduct }))
      : [blankItem()],
  );
  const [discount, setDiscount] = useState(String(initial?.discount ?? ""));
  const [delivery, setDelivery] = useState(String(initial?.deliveryCharge ?? ""));

  const byId = useMemo(() => new Map(variants.map((v) => [v.id, v])), [variants]);
  const pickerOptions = useMemo(
    () => variants.map((v) => ({ id: v.id, label: v.label, search: v.sku, hint: v.stock > 0 ? `${v.stock} in stock` : "out of stock", dim: v.stock <= 0 })),
    [variants],
  );
  const subtotal = items.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.unitPrice) || 0), 0);
  const total = Math.max(0, subtotal - (Number(discount) || 0) + (Number(delivery) || 0));
  const patch = (uid: number, p: Partial<ItemState>) => setItems((list) => list.map((i) => (i.uid === uid ? { ...i, ...p } : i)));

  function pickVariant(uid: number, variantId: string) {
    const v = byId.get(variantId);
    if (!v) return patch(uid, { variantId: "", deduct: false });
    patch(uid, { variantId, description: v.label, unitPrice: String(v.price), unitCost: v.cost != null ? v.cost.toFixed(2) : "", deduct: v.stock > 0 });
  }

  const payload = JSON.stringify(
    items.map((i) => ({ description: i.description, variantId: i.variantId || null, qty: i.qty, unitPrice: i.unitPrice || 0, unitCost: i.unitCost, deduct: i.deduct && !!i.variantId })),
  );

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="items" value={payload} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 desktop:grid-cols-4">
        <Field label="SALE DATE">
          <input type="date" name="date" required defaultValue={initial?.date ?? today} className={inputCls} />
        </Field>
        <Field label="CUSTOMER NAME" className="sm:col-span-1 desktop:col-span-1">
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
        <div className="font-label mb-1.5 text-[12px] tracking-[1px] text-muted">ITEMS SOLD</div>
        <div className="space-y-2.5">
          {items.map((it, idx) => {
            const v = byId.get(it.variantId);
            return (
              <div key={it.uid} className="border border-line bg-ink/40 p-3">
                <div className="grid grid-cols-2 gap-2.5 desktop:grid-cols-[2fr_2fr_70px_110px_110px_auto]">
                  <ProductPicker
                    className="col-span-2 desktop:col-span-1"
                    ariaLabel={`Item ${idx + 1}: search your products`}
                    customLabel="Custom item — or search your products…"
                    options={pickerOptions}
                    value={it.variantId}
                    onChange={(id) => pickVariant(it.uid, id)}
                  />
                  <input value={it.description} onChange={(e) => patch(it.uid, { description: e.target.value })} placeholder="Description" required maxLength={200} aria-label={`Item ${idx + 1} description`} className={`${inputCls} col-span-2 desktop:col-span-1`} />
                  <input type="number" min={1} step={1} value={it.qty} onChange={(e) => patch(it.uid, { qty: e.target.value })} aria-label={`Item ${idx + 1} quantity`} placeholder="Qty" required className={inputCls} />
                  <input type="number" min={0} step="0.01" inputMode="decimal" value={it.unitPrice} onChange={(e) => patch(it.uid, { unitPrice: e.target.value })} aria-label={`Item ${idx + 1} price each`} placeholder="Price each ৳" required className={inputCls} />
                  <input type="number" min={0} step="0.01" inputMode="decimal" value={it.unitCost} onChange={(e) => patch(it.uid, { unitCost: e.target.value })} aria-label={`Item ${idx + 1} cost each`} placeholder="Cost each ৳" className={inputCls} />
                  <button type="button" disabled={items.length === 1} onClick={() => setItems((l) => l.filter((x) => x.uid !== it.uid))} className={btnGhost} aria-label={`Remove item ${idx + 1}`}>
                    Remove
                  </button>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted">
                  {v ? (
                    <label className="flex cursor-pointer items-center gap-1.5">
                      <input type="checkbox" checked={it.deduct} onChange={(e) => patch(it.uid, { deduct: e.target.checked })} /> Take {it.qty || 0} off stock ({v.stock} in stock now)
                    </label>
                  ) : (
                    <span>Custom item — stock isn&apos;t touched.</span>
                  )}
                  <span>Cost each starts from the product&apos;s purchase cost — change it to override. With no cost at all, the item shows as &ldquo;no cost&rdquo; in the profit figures.</span>
                  <span className="ml-auto text-paper">Line: {formatTakaPrecise((Number(it.qty) || 0) * (Number(it.unitPrice) || 0))}</span>
                </div>
              </div>
            );
          })}
        </div>
        <button type="button" onClick={() => setItems((l) => [...l, blankItem()])} className={`${btnGhost} mt-2.5`}>
          + Add another item
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
        <label className="flex items-end gap-2 pb-2 text-sm">
          <input type="checkbox" name="paid" defaultChecked={initial ? initial.paid : true} className="mb-1" /> Payment received
          <span className="text-[12px] text-muted">(untick if they still owe it)</span>
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
          <button type="button" onClick={onDone} className={btnGhost}>
            Cancel
          </button>
        )}
        <span className="ml-auto text-sm">
          Items {formatTakaPrecise(subtotal)}
          {Number(discount) > 0 && <> − discount {formatTakaPrecise(Number(discount))}</>}
          {Number(delivery) > 0 && <> + delivery {formatTakaPrecise(Number(delivery))}</>} = <span className="font-impact text-lg text-lime">{formatTakaPrecise(total)}</span>
        </span>
        {state && !state.ok && (
          <p role="alert" className="w-full text-[13px] text-error">
            {state.error}
          </p>
        )}
      </div>
    </form>
  );
}

function CashCell({ r }: { r: SaleListRow }) {
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  if (r.removed || r.status === "LOST" || r.status === "UNPAID") return <span className="text-muted-2">—</span>;

  if (r.cashStatus === "COLLECTED") {
    return (
      <div>
        <span className="font-label whitespace-nowrap bg-lime/[0.16] px-2 py-0.5 text-[11px] tracking-[0.8px] text-lime">CASH COLLECTED</span>
        <div className="mt-0.5 text-[12px] text-muted">{r.cashOn}</div>
        {r.source === "ORDER" && r.canUndoCash && (
          <button
            type="button"
            disabled={pending}
            className="text-[12px] text-muted underline hover:text-paper disabled:opacity-50"
            onClick={() => {
              if (!confirm(`Mark ${r.ref} as cash NOT collected? It goes back to awaiting its cash.`)) return;
              start(async () => {
                const x = await undoCashCollected(r.id);
                if (!x.ok) setError(x.error);
              });
            }}
          >
            Undo
          </button>
        )}
        {error && <p className="text-[12px] text-error">{error}</p>}
      </div>
    );
  }
  if (r.cashStatus === "AWAITING") {
    return (
      <div>
        <span className="font-label whitespace-nowrap bg-yellow/[0.16] px-2 py-0.5 text-[11px] tracking-[0.8px] text-yellow">AWAITING CASH</span>
        {open ? (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <input type="date" value={day} onChange={(e) => setDay(e.target.value)} aria-label={`Date cash was collected for ${r.ref}`} className="border border-line-2 bg-ink px-2 py-1 text-[12px] outline-none focus:border-lime" />
            <button
              type="button"
              disabled={pending || !day}
              className={btnPrimary + " !px-3 !py-1 !text-[12px]"}
              onClick={() =>
                start(async () => {
                  const x = await markCashCollected(r.id, day);
                  if (!x.ok) setError(x.error);
                  else setOpen(false);
                })
              }
            >
              {pending ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="text-[12px] text-muted underline">
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="mt-1 block text-[12px] text-cyan underline"
            onClick={() => {
              setDay(todayKey());
              setOpen(true);
            }}
          >
            Mark cash collected
          </button>
        )}
        {error && <p className="text-[12px] text-error">{error}</p>}
      </div>
    );
  }
  return <span className="text-muted-2">{r.source === "ORDER" ? "not delivered yet" : "—"}</span>;
}

/** Today in Dhaka as YYYY-MM-DD, for the "collected on" date box. */
function todayKey() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function SalesManager({ rows, manual, variants, today }: { rows: SaleListRow[]; manual: Record<string, ManualSaleInitial>; variants: VariantOption[]; today: string }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [addKey, setAddKey] = useState(0);
  const sel = useSelection(rows.map((r) => r.key));
  const chosen = rows.filter((r) => sel.has(r.key));
  const chosenManual = chosen.filter((r) => r.source === "MANUAL");
  const chosenOnline = chosen.filter((r) => r.source === "ORDER" && !r.removed);
  const chosenRemoved = chosen.filter((r) => r.removed);

  return (
    <div>
      <details className="mb-4.5 border border-line bg-panel" open>
        <summary className="font-impact cursor-pointer select-none px-4.5 py-3.5 text-[17px] uppercase tracking-[0.5px]">Record a sale made outside the website</summary>
        <div className="border-t border-line p-4.5">
          <ManualSaleForm key={addKey} variants={variants} today={today} onDone={() => setAddKey((k) => k + 1)} />
        </div>
      </details>

      <BulkBar
        count={sel.count}
        onClear={sel.clear}
        actions={[
          ...(chosenManual.length
            ? [
                {
                  label: `Delete ${chosenManual.length} manual sale${chosenManual.length === 1 ? "" : "s"}`,
                  confirmText: `Permanently delete ${chosenManual.length} manual sale${chosenManual.length === 1 ? "" : "s"}? Any stock they took is put back. This can't be undone.`,
                  run: () => deleteManualSales(chosenManual.map((r) => r.id)),
                },
              ]
            : []),
          ...(chosenOnline.length
            ? [
                {
                  label: `Remove ${chosenOnline.length} order${chosenOnline.length === 1 ? "" : "s"} from finance`,
                  confirmText: `Take ${chosenOnline.length} online order${chosenOnline.length === 1 ? "" : "s"} out of every finance report? The orders themselves are not touched, and you can restore them later.`,
                  run: () => setOrdersExcludedFromFinance(chosenOnline.map((r) => r.id), true),
                },
              ]
            : []),
          ...(chosenRemoved.length
            ? [
                {
                  label: `Restore ${chosenRemoved.length} order${chosenRemoved.length === 1 ? "" : "s"} to finance`,
                  confirmText: `Put ${chosenRemoved.length} order${chosenRemoved.length === 1 ? "" : "s"} back into the finance reports?`,
                  run: () => setOrdersExcludedFromFinance(chosenRemoved.map((r) => r.id), false),
                  danger: false,
                },
              ]
            : []),
        ]}
      />

      <Panel className="!p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-sm">
            <thead>
              <tr className="border-b border-line-2 text-left text-muted">
                <th className="w-9 px-3 py-2.5">
                  <RowCheck checked={sel.allTicked} onChange={sel.toggleAll} label="Select all sales" />
                </th>
                {["Date", "Sale", "Customer", "Items", "Status", "Cash", "Revenue", "Cost", "Profit", ""].map((h, i) => (
                  <th key={i} className={`font-label px-3 py-2.5 text-[13px] tracking-[0.8px] ${["Revenue", "Cost", "Profit"].includes(h) ? "text-right" : ""}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) =>
                r.source === "MANUAL" && editing === r.id && manual[r.id] ? (
                  <tr key={r.key} id={r.id} className="border-b border-line bg-panel-2/40">
                    <td colSpan={11} className="p-4">
                      <div className="font-label mb-3 text-[12px] tracking-[1px] text-muted">EDITING {r.ref}</div>
                      <ManualSaleForm initial={manual[r.id]} variants={variants} today={today} onDone={() => setEditing(null)} />
                    </td>
                  </tr>
                ) : (
                  <tr key={r.key} id={r.id} className={`border-b border-line align-top ${r.removed ? "opacity-60" : ""}`}>
                    <td className="px-3 py-3">
                      <RowCheck checked={sel.has(r.key)} onChange={() => sel.toggle(r.key)} label={`Select ${r.ref}`} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">{r.date}</td>
                    <td className="whitespace-nowrap px-3 py-3">
                      {r.source === "ORDER" ? (
                        <Link href={r.href} prefetch={false} className="text-cyan hover:underline">
                          {r.ref}
                        </Link>
                      ) : (
                        <span className="text-paper">{r.ref}</span>
                      )}
                      <div className="text-[11px] tracking-[0.8px] text-muted-2">
                        {r.source === "ORDER" ? "ONLINE ORDER" : "MANUAL"} · {r.paymentLabel}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div>{r.customerName}</div>
                      {r.customerPhone && <div className="text-[12px] text-muted">{r.customerPhone}</div>}
                    </td>
                    <td className="max-w-[260px] px-3 py-3 text-[12px] text-muted">{r.itemsSummary || "—"}</td>
                    <td className="px-3 py-3">
                      {r.removed ? <SaleStatusChip status="LOST" label="Removed from finance" /> : <SaleStatusChip status={r.status} label={r.statusLabel} />}
                    </td>
                    <td className="px-3 py-3">
                      <CashCell r={r} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right">
                      <Money value={r.revenue} tone="plain" />
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right text-muted">
                      {r.status === "COMPLETED" && !r.removed ? <Money value={r.cogs} tone="plain" /> : "—"}
                      {r.status === "COMPLETED" && !r.removed && r.unknownCostUnits > 0 && (
                        <div className="text-[11px] text-yellow" title="Some items have no recorded cost, so this profit is overstated">
                          {r.unknownCostUnits} unit{r.unknownCostUnits === 1 ? "" : "s"} no cost
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right">{r.status === "COMPLETED" && !r.removed ? <Money value={r.profit} /> : <span className="text-muted-2">—</span>}</td>
                    <td className="px-3 py-3">
                      {r.source === "MANUAL" ? (
                        <RowActions onEdit={() => setEditing(r.id)} onDelete={() => deleteManualSale(r.id)} confirmText={`Delete sale ${r.ref} to ${r.customerName}? Any stock it took off the shelf is put back. This can't be undone.`} />
                      ) : r.removed ? (
                        <div className="text-right">
                          <RemoveButton id={r.id} ref_={r.ref} restore />
                        </div>
                      ) : (
                        <div className="flex justify-end gap-1.5">
                          <Link href={r.href} prefetch={false} className={btnGhost + " inline-block"}>
                            Open order
                          </Link>
                          <RemoveButton id={r.id} ref_={r.ref} />
                        </div>
                      )}
                    </td>
                  </tr>
                ),
              )}
              {rows.length === 0 && <EmptyRow cols={11}>No sales match. Orders from the website appear here automatically; record other sales above.</EmptyRow>}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

/** "Remove from finance" for an online order (the order itself stays), or "Restore" for one that was removed. */
function RemoveButton({ id, ref_, restore = false }: { id: string; ref_: string; restore?: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className={restore ? btnGhost : btnDanger}
      title={restore ? "Count this order in the finance reports again" : "Leave this order out of every finance report — the order itself is not touched"}
      onClick={() => {
        const ok = restore ? confirm(`Put ${ref_} back into the finance reports?`) : confirm(`Remove ${ref_} from the finance reports?\n\nThe order itself is not touched (it stays under Orders and in the customer's account). You can restore it later from the "Removed from finance" filter.`);
        if (ok) start(async () => void (await setOrdersExcludedFromFinance([id], !restore)));
      }}
    >
      {pending ? "…" : restore ? "Restore" : "Remove"}
    </button>
  );
}
