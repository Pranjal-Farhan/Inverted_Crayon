"use client";

import { useMemo, useState, useTransition } from "react";
import { saveInvestment, deleteInvestment, deleteInvestments, createStockOwner, saveStockOwner, deleteStockOwner } from "@/actions/admin-finance";
import { Panel } from "@/components/admin/Panel";
import { formatTaka } from "@/lib/money";
import { useServerForm } from "./useServerForm";
import { BulkBar, RowCheck, useSelection } from "./selection";
import { ProductPicker } from "./ProductPicker";
import { Field, Money, EmptyRow, RowActions, METHOD_OPTIONS, inputCls, btnGhost, btnPrimary } from "./ui-client";

export type ShipmentLine = { variantId: string | null; label: string; quantity: number; unitCost: number; lineTotal: number };
export type ShipmentRow = {
  id: string;
  date: string;
  ownerId: string;
  ownerName: string;
  supplier: string;
  description: string;
  method: string;
  notes: string;
  shipmentCost: number;
  goods: number;
  amount: number;
  items: ShipmentLine[];
};
export type LegacyRow = { id: string; date: string; ownerName: string; amount: number; description: string };
export type OwnerRow = { id: string; name: string; contact: string; notes: string; invested: number; shipments: number; expensesPaid: number };
/** One size/colour of a product. `cost` is the product's purchase cost (null = not entered yet). */
export type VariantOption = { id: string; label: string; sku: string; productId: string; productTitle: string; cost: number | null; stock: number };

let lineUid = 1;
type LineState = { uid: number; variantId: string; quantity: string; unitCost: string };
const blankLine = (): LineState => ({ uid: lineUid++, variantId: "", quantity: "", unitCost: "" });

const num = (v: string) => (v.trim() === "" ? 0 : Number(v));

function ShipmentForm({ initial, owners, variants, today, onDone }: { initial?: ShipmentRow; owners: OwnerRow[]; variants: VariantOption[]; today: string; onDone: () => void }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [date, setDate] = useState(initial?.date ?? today);
  const [ownerId, setOwnerId] = useState(initial?.ownerId ?? "");
  const [supplier, setSupplier] = useState(initial?.supplier ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [method, setMethod] = useState(initial?.method ?? "CASH");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [shipmentCost, setShipmentCost] = useState(initial ? String(initial.shipmentCost) : "");
  const [updateCosts, setUpdateCosts] = useState(false);
  const [lines, setLines] = useState<LineState[]>(() =>
    initial ? initial.items.map((i) => ({ uid: lineUid++, variantId: i.variantId ?? "", quantity: String(i.quantity), unitCost: String(i.unitCost) })) : [blankLine()],
  );
  const [productKey, setProductKey] = useState(0);

  const byId = useMemo(() => new Map(variants.map((v) => [v.id, v])), [variants]);
  const variantOptions = useMemo(
    () => variants.map((v) => ({ id: v.id, label: v.label, search: v.sku, hint: `${v.stock} in stock${v.cost != null ? ` · cost ${formatTaka(v.cost)}` : ""}` })),
    [variants],
  );
  const productOptions = useMemo(() => {
    const m = new Map<string, { id: string; label: string; n: number }>();
    for (const v of variants) {
      const e = m.get(v.productId) ?? { id: v.productId, label: v.productTitle, n: 0 };
      e.n += 1;
      m.set(v.productId, e);
    }
    return [...m.values()].map((p) => ({ id: p.id, label: p.label, hint: `${p.n} sizes/colours` }));
  }, [variants]);

  const patch = (uid: number, p: Partial<LineState>) => setLines((ls) => ls.map((l) => (l.uid === uid ? { ...l, ...p } : l)));
  const pickVariant = (uid: number, variantId: string) => {
    const v = byId.get(variantId);
    patch(uid, { variantId, unitCost: v?.cost != null ? v.cost.toFixed(2) : "" });
  };
  /** Every size/colour of a product as its own line, so a whole shipment of one product is quick to fill in. */
  const addAllOf = (productId: string) => {
    const have = new Set(lines.map((l) => l.variantId));
    const fresh = variants
      .filter((v) => v.productId === productId && !have.has(v.id))
      .map((v) => ({ uid: lineUid++, variantId: v.id, quantity: "", unitCost: v.cost != null ? v.cost.toFixed(2) : "" }));
    // The empty starter line goes away once real ones arrive.
    setLines((ls) => [...ls.filter((l) => l.variantId || l.quantity || l.unitCost), ...fresh]);
    setProductKey((k) => k + 1);
  };

  const counted = lines.filter((l) => l.variantId && num(l.quantity) > 0);
  const goods = counted.reduce((t, l) => t + num(l.quantity) * num(l.unitCost), 0);
  const units = counted.reduce((t, l) => t + num(l.quantity), 0);
  const total = goods + num(shipmentCost);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (counted.length === 0) {
      setError("Add at least one product with a quantity.");
      return;
    }
    start(async () => {
      const r = await saveInvestment({
        id: initial?.id,
        date,
        ownerId,
        supplierName: supplier,
        description,
        method: method as "CASH",
        notes,
        shipmentCost: shipmentCost.trim() === "" ? 0 : shipmentCost,
        updateProductCosts: updateCosts,
        items: counted.map((l) => ({ variantId: l.variantId, quantity: l.quantity, unitCost: l.unitCost.trim() === "" ? 0 : l.unitCost })),
      });
      if (!r.ok) setError(r.error);
      else onDone();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 desktop:grid-cols-4">
        <Field label="DATE PAID">
          <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
        </Field>
        <Field label="PAID BY (OWNER)">
          <select required value={ownerId} onChange={(e) => setOwnerId(e.target.value)} aria-label="Paid by owner" className={inputCls}>
            <option value="" disabled>
              {owners.length ? "Choose an owner" : "Add an owner first ↓"}
            </option>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="SUPPLIER (OPTIONAL)">
          <input value={supplier} maxLength={120} onChange={(e) => setSupplier(e.target.value)} placeholder="Who you bought from" className={inputCls} />
        </Field>
        <Field label="HOW IT WAS PAID">
          <select value={method} onChange={(e) => setMethod(e.target.value)} className={inputCls}>
            {METHOD_OPTIONS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div>
        <div className="font-label mb-1.5 text-[12px] tracking-[1px] text-muted">WHAT CAME IN — PRODUCTS AND THEIR COST</div>
        {/* A grid, not a scrolling table: the product list drops down over the rows below and a scroll container would clip it. */}
        <div className="hidden gap-2 px-0.5 pb-1 text-muted sm:grid sm:grid-cols-[minmax(0,1fr)_96px_120px_110px_36px]">
          <span className="font-label text-[12px] tracking-[0.8px]">PRODUCT (SIZE / COLOUR)</span>
          <span className="font-label text-[12px] tracking-[0.8px]">QTY</span>
          <span className="font-label text-[12px] tracking-[0.8px]">COST EACH ৳</span>
          <span className="font-label text-right text-[12px] tracking-[0.8px]">LINE TOTAL</span>
          <span />
        </div>
        <div className="space-y-2">
          {lines.map((l, idx) => (
            <div key={l.uid} className="grid grid-cols-2 items-start gap-2 sm:grid-cols-[minmax(0,1fr)_96px_120px_110px_36px]">
              <div className="col-span-2 sm:col-span-1">
                <ProductPicker
                  options={variantOptions}
                  value={l.variantId}
                  onChange={(id) => pickVariant(l.uid, id)}
                  placeholder="Search products — name, size, colour or SKU…"
                  ariaLabel={`Line ${idx + 1} product`}
                />
              </div>
              <input type="number" min={1} step={1} inputMode="numeric" value={l.quantity} onChange={(e) => patch(l.uid, { quantity: e.target.value })} placeholder="Qty" aria-label={`Line ${idx + 1} quantity`} className={inputCls} />
              <input type="number" min={0} step="0.01" inputMode="decimal" value={l.unitCost} onChange={(e) => patch(l.uid, { unitCost: e.target.value })} placeholder="Cost each" aria-label={`Line ${idx + 1} cost each`} className={inputCls} />
              <div className="py-2 text-right text-sm tabular-nums">{l.variantId && num(l.quantity) > 0 ? formatTaka(num(l.quantity) * num(l.unitCost)) : "—"}</div>
              <button type="button" onClick={() => setLines((ls) => (ls.length > 1 ? ls.filter((x) => x.uid !== l.uid) : [blankLine()]))} aria-label={`Remove line ${idx + 1}`} className="py-1.5 text-muted hover:text-error">
                ✕
              </button>
            </div>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
          <button type="button" onClick={() => setLines((ls) => [...ls, blankLine()])} className={btnGhost}>
            + Add a product
          </button>
          <div className="min-w-[260px] flex-1 sm:max-w-[380px]">
            <ProductPicker
              key={productKey}
              options={productOptions}
              value=""
              onChange={(id) => id && addAllOf(id)}
              placeholder="+ Add every size & colour of a product…"
              ariaLabel="Add every size and colour of a product"
            />
          </div>
          <span className="text-[12px] text-muted-2">Lines with no quantity are left out.</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 desktop:grid-cols-4">
        <Field label="SHIPMENT COST ৳ (FREIGHT, CUSTOMS…)">
          <input type="number" min={0} step="0.01" inputMode="decimal" value={shipmentCost} onChange={(e) => setShipmentCost(e.target.value)} placeholder="0.00" aria-label="Shipment cost" className={inputCls} />
        </Field>
        <Field label="LABEL (OPTIONAL)" className="desktop:col-span-2">
          <input value={description} maxLength={140} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Winter drop — first container" className={inputCls} />
        </Field>
        <Field label="NOTES (OPTIONAL)">
          <input value={notes} maxLength={500} onChange={(e) => setNotes(e.target.value)} className={inputCls} />
        </Field>
      </div>

      <div className="border border-line-2 bg-panel-2/40 px-3.5 py-3 text-sm">
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
          <span className="text-muted">
            Products <span className="text-paper">{formatTaka(goods)}</span> <span className="text-[12px]">({units} {units === 1 ? "unit" : "units"})</span>
          </span>
          <span className="text-muted">
            + Shipment <span className="text-paper">{formatTaka(num(shipmentCost))}</span>
          </span>
          <span className="ml-auto font-impact text-[18px]">
            Total paid <span className="text-lime">{formatTaka(total)}</span>
          </span>
        </div>
        <label className="mt-2.5 flex cursor-pointer items-start gap-2 text-[13px] text-muted">
          <input type="checkbox" checked={updateCosts} onChange={(e) => setUpdateCosts(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#c3f53a]" />
          <span>
            Also save these costs as each product&apos;s purchase cost (profit is worked out from it). Products with no purchase cost yet get it either way.
          </span>
        </label>
        <p className="mt-2 text-[12px] text-muted-2">
          Recording this puts the units on the shelf. The total counts as money paid out for stock; the shipment cost also counts against profit this month, and the products themselves count against profit when they sell.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <button type="submit" disabled={pending} className={btnPrimary}>
          {pending ? "Saving…" : initial ? "Save changes" : "Record shipment"}
        </button>
        {initial && (
          <button type="button" onClick={onDone} className={btnGhost}>
            Cancel
          </button>
        )}
        {error && (
          <p role="alert" className="text-[13px] text-error">
            {error}
          </p>
        )}
      </div>
    </form>
  );
}

function OwnerForm({ initial, onDone }: { initial?: OwnerRow; onDone: () => void }) {
  const { state, pending, onSubmit } = useServerForm(initial ? saveStockOwner : createStockOwner, onDone);
  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <Field label="NAME">
        <input name="name" required maxLength={100} defaultValue={initial?.name} placeholder="Owner / partner name" className={inputCls} />
      </Field>
      <Field label="CONTACT (OPTIONAL)">
        <input name="contact" maxLength={120} defaultValue={initial?.contact} placeholder="Phone or email" className={inputCls} />
      </Field>
      <Field label="NOTES (OPTIONAL)">
        <input name="notes" maxLength={300} defaultValue={initial?.notes} className={inputCls} />
      </Field>
      <div className="flex flex-wrap items-center gap-2.5 sm:col-span-3">
        <button type="submit" disabled={pending} className={btnPrimary}>
          {pending ? "Saving…" : initial ? "Save owner" : "Add owner"}
        </button>
        {initial && (
          <button type="button" onClick={onDone} className={btnGhost}>
            Cancel
          </button>
        )}
        {state && !state.ok && (
          <p role="alert" className="text-[13px] text-error">
            {state.error}
          </p>
        )}
      </div>
    </form>
  );
}

export function InvestmentsManager({
  rows,
  legacy,
  owners,
  variants,
  today,
  total,
}: {
  rows: ShipmentRow[];
  legacy: LegacyRow[];
  owners: OwnerRow[];
  variants: VariantOption[];
  today: string;
  total: number;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [editingOwner, setEditingOwner] = useState<string | null>(null);
  const [addKey, setAddKey] = useState(0);
  const [ownerKey, setOwnerKey] = useState(0);
  const sel = useSelection(rows.map((r) => r.id));

  return (
    <div>
      <p className="mb-3.5 text-[13px] text-muted">
        An investment is a <span className="text-paper">stock shipment you paid for</span>: the products that came in, what each unit cost, and what the shipment itself cost. It counts as your stock purchase — it puts the units on the shelf and is money paid out — and the products become a cost when they sell.
      </p>

      <Panel title="Record a stock shipment" className="mb-4.5">
        <ShipmentForm key={addKey} owners={owners} variants={variants} today={today} onDone={() => setAddKey((k) => k + 1)} />
      </Panel>

      <BulkBar
        count={sel.count}
        onClear={sel.clear}
        actions={[
          {
            label: `Delete ${sel.count} shipment${sel.count === 1 ? "" : "s"}`,
            confirmText: `Permanently delete ${sel.count} shipment${sel.count === 1 ? "" : "s"}? Their units are taken back off the shelf (refused for any whose stock has already been sold) and they stop counting as money paid out. This can't be undone.`,
            run: () => deleteInvestments(sel.ids),
          },
        ]}
      />

      <Panel className="mb-4.5 !p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-line-2 text-left text-muted">
                <th className="w-9 px-4 py-2.5">
                  <RowCheck checked={sel.allTicked} onChange={sel.toggleAll} label="Select all shipments" />
                </th>
                {["Date", "Paid by", "Shipment", "Products", "Shipment cost", "Total", ""].map((h, i) => (
                  <th key={i} className={`font-label px-4 py-2.5 text-[13px] tracking-[0.8px] ${h === "Total" || h === "Products" || h === "Shipment cost" ? "text-right" : ""}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) =>
                editing === r.id ? (
                  <tr key={r.id} className="border-b border-line bg-panel-2/40">
                    <td colSpan={8} className="p-4">
                      <ShipmentForm initial={r} owners={owners} variants={variants} today={today} onDone={() => setEditing(null)} />
                    </td>
                  </tr>
                ) : (
                  <tr key={r.id} className="border-b border-line align-top">
                    <td className="px-4 py-3">
                      <RowCheck checked={sel.has(r.id)} onChange={() => sel.toggle(r.id)} label={`Select shipment on ${r.date} by ${r.ownerName}`} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">{r.date}</td>
                    <td className="whitespace-nowrap px-4 py-3">{r.ownerName}</td>
                    <td className="px-4 py-3">
                      <div>{r.description || (r.supplier ? `From ${r.supplier}` : "Stock shipment")}</div>
                      {r.description && r.supplier && <div className="text-[12px] text-muted">From {r.supplier}</div>}
                      <ul className="mt-1 space-y-0.5 text-[12px] text-muted">
                        {r.items.map((i, k) => (
                          <li key={k}>
                            {i.quantity}× {i.label} <span className="text-muted-2">@ {formatTaka(i.unitCost)}</span>
                          </li>
                        ))}
                      </ul>
                      {r.notes && <div className="mt-1 text-[12px] text-muted-2">{r.notes}</div>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <Money value={r.goods} tone="plain" />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <Money value={r.shipmentCost} tone="plain" />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <Money value={r.amount} tone="out" />
                    </td>
                    <td className="px-4 py-3">
                      <RowActions
                        onEdit={r.items.every((i) => i.variantId) ? () => setEditing(r.id) : undefined}
                        onDelete={() => deleteInvestment(r.id)}
                        confirmText={`Delete this shipment (${formatTaka(r.amount)} paid by ${r.ownerName})? Its units come back off the shelf (refused if some were already sold) and it stops counting as money paid out. This can't be undone.`}
                      />
                    </td>
                  </tr>
                ),
              )}
              {rows.length === 0 && <EmptyRow cols={8}>No shipments in this period. Record one above.</EmptyRow>}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="border-t border-line-2">
                  <td colSpan={6} className="font-label px-4 py-3 text-[13px] tracking-[0.8px] text-muted">
                    TOTAL ({rows.length} {rows.length === 1 ? "shipment" : "shipments"})
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    <Money value={total} tone="out" />
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Panel>

      {legacy.length > 0 && (
        <details className="mb-4.5 border border-line bg-panel">
          <summary className="cursor-pointer select-none px-4 py-3 text-[13px] text-muted hover:text-paper">
            {legacy.length} earlier {legacy.length === 1 ? "entry" : "entries"} from before investments tracked shipments — kept for the record, <span className="text-yellow">not counted anywhere</span>
          </summary>
          <div className="overflow-x-auto border-t border-line">
            <table className="w-full min-w-[560px] text-sm">
              <tbody>
                {legacy.map((l) => (
                  <tr key={l.id} className="border-b border-line">
                    <td className="whitespace-nowrap px-4 py-2.5">{l.date}</td>
                    <td className="whitespace-nowrap px-4 py-2.5">{l.ownerName}</td>
                    <td className="px-4 py-2.5 text-muted">{l.description || "Money put in"}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right">
                      <Money value={l.amount} tone="plain" />
                    </td>
                    <td className="px-4 py-2.5">
                      <RowActions onDelete={() => deleteInvestment(l.id)} confirmText={`Delete this old entry (${formatTaka(l.amount)} by ${l.ownerName})? It isn't counted anywhere, so no figure changes.`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      <Panel title="Owners">
        <p className="mb-3 text-[13px] text-muted">The people who pay for stock and expenses. Add everyone here before choosing them on a shipment or an expense.</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-line-2 text-left text-muted">
                {["Owner", "Invested (shipments paid)", "Expenses paid", ""].map((h, i) => (
                  <th key={i} className="font-label px-3 py-2 text-[13px] tracking-[0.8px]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {owners.map((o) =>
                editingOwner === o.id ? (
                  <tr key={o.id} className="border-b border-line bg-panel-2/40">
                    <td colSpan={4} className="p-3">
                      <OwnerForm initial={o} onDone={() => setEditingOwner(null)} />
                    </td>
                  </tr>
                ) : (
                  <tr key={o.id} className="border-b border-line align-top">
                    <td className="px-3 py-2.5">
                      <div>{o.name}</div>
                      {(o.contact || o.notes) && <div className="text-[12px] text-muted">{[o.contact, o.notes].filter(Boolean).join(" · ")}</div>}
                    </td>
                    <td className="px-3 py-2.5">
                      <Money value={o.invested} tone="plain" />
                      <span className="ml-1.5 text-[12px] text-muted-2">
                        {o.shipments} {o.shipments === 1 ? "shipment" : "shipments"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <Money value={o.expensesPaid} tone="plain" />
                    </td>
                    <td className="px-3 py-2.5">
                      <RowActions onEdit={() => setEditingOwner(o.id)} onDelete={() => deleteStockOwner(o.id)} confirmText={`Remove ${o.name}?`} />
                    </td>
                  </tr>
                ),
              )}
              {owners.length === 0 && <EmptyRow cols={4}>No owners yet — add the first one below.</EmptyRow>}
            </tbody>
          </table>
        </div>
        <div className="mt-4 border-t border-line pt-4">
          <div className="font-label mb-2 text-[12px] tracking-[1px] text-muted">ADD AN OWNER</div>
          <OwnerForm key={ownerKey} onDone={() => setOwnerKey((k) => k + 1)} />
        </div>
      </Panel>
    </div>
  );
}
