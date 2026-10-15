"use client";

import { useState } from "react";
import { updateStockPurchase, deleteStockPurchase } from "@/actions/admin-finance";
import { Panel } from "@/components/admin/Panel";
import { StockPurchaseForm } from "@/components/admin/FinanceForms";
import { useServerForm } from "./useServerForm";
import { Field, Money, EmptyRow, RowActions, inputCls, btnGhost, btnPrimary } from "./ui-client";

export type PurchaseRow = {
  id: string;
  date: string;
  ownerId: string;
  ownerName: string;
  product: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  supplier: string;
  notes: string;
};

function PurchaseEditForm({ row, owners, onDone }: { row: PurchaseRow; owners: { id: string; name: string }[]; onDone: () => void }) {
  const { state, pending, onSubmit } = useServerForm(updateStockPurchase, onDone);
  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2 desktop:grid-cols-4">
      <input type="hidden" name="id" value={row.id} />
      <div className="text-sm sm:col-span-2 desktop:col-span-4">
        <span className="text-paper">{row.product}</span> · {row.quantity} × <Money value={row.unitCost} tone="plain" /> = <Money value={row.totalCost} tone="plain" />
        <span className="ml-2 text-[12px] text-muted">The product, quantity and cost can&apos;t be changed (they set the stock and the cost price) — delete this purchase and record it again to fix them.</span>
      </div>
      <Field label="DATE">
        <input type="date" name="date" required defaultValue={row.date} className={inputCls} />
      </Field>
      <Field label="PAID FOR BY">
        <select name="ownerId" required defaultValue={row.ownerId} className={inputCls}>
          {owners.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="SUPPLIER">
        <input name="supplierName" maxLength={120} defaultValue={row.supplier} className={inputCls} />
      </Field>
      <Field label="NOTES">
        <input name="notes" maxLength={500} defaultValue={row.notes} className={inputCls} />
      </Field>
      <div className="flex flex-wrap items-center gap-2.5 sm:col-span-2 desktop:col-span-4">
        <button type="submit" disabled={pending} className={btnPrimary}>
          {pending ? "Saving…" : "Save changes"}
        </button>
        <button type="button" onClick={onDone} className={btnGhost}>
          Cancel
        </button>
        {state && !state.ok && (
          <p role="alert" className="text-[13px] text-error">
            {state.error}
          </p>
        )}
      </div>
    </form>
  );
}

export function StockManager({
  rows,
  owners,
  variants,
  total,
}: {
  rows: PurchaseRow[];
  owners: { id: string; name: string }[];
  variants: { id: string; label: string }[];
  total: number;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <div>
      <p className="mb-3.5 text-[13px] text-muted">
        Stock you buy is recorded here. It adds the units to the product&apos;s stock and sets what each one cost you — that cost is deducted from the sale price as <span className="text-paper">cost of goods</span> when the item sells. It is not counted as an expense when you buy it.
      </p>
      <div className="mb-4.5">
        <StockPurchaseForm owners={owners} variants={variants} />
      </div>
      <Panel className="!p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-line-2 text-left text-muted">
                {["Date", "Paid for by", "Product", "Qty", "Unit cost", "Total", "Supplier", ""].map((h, i) => (
                  <th key={i} className={`font-label px-3 py-2.5 text-[13px] tracking-[0.8px] ${["Unit cost", "Total"].includes(h) ? "text-right" : ""}`}>
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
                      <PurchaseEditForm row={r} owners={owners} onDone={() => setEditing(null)} />
                    </td>
                  </tr>
                ) : (
                  <tr key={r.id} className="border-b border-line align-top">
                    <td className="whitespace-nowrap px-3 py-3">{r.date}</td>
                    <td className="px-3 py-3">{r.ownerName}</td>
                    <td className="px-3 py-3">
                      {r.product}
                      {r.notes && <div className="text-[12px] text-muted">{r.notes}</div>}
                    </td>
                    <td className="px-3 py-3">{r.quantity}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-right">
                      <Money value={r.unitCost} tone="plain" />
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right">
                      <Money value={r.totalCost} tone="plain" />
                    </td>
                    <td className="px-3 py-3 text-muted">{r.supplier || "—"}</td>
                    <td className="px-3 py-3">
                      <RowActions onEdit={() => setEditing(r.id)} onDelete={() => deleteStockPurchase(r.id)} confirmText={`Delete this purchase (${r.quantity} × ${r.product})? Those units are taken back off the product's stock.`} />
                    </td>
                  </tr>
                ),
              )}
              {rows.length === 0 && <EmptyRow cols={8}>No stock purchases in this period.</EmptyRow>}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="border-t border-line-2">
                  <td colSpan={5} className="font-label px-3 py-3 text-[13px] tracking-[0.8px] text-muted">
                    TOTAL ({rows.length})
                  </td>
                  <td className="px-3 py-3 text-right font-medium">
                    <Money value={total} tone="plain" />
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Panel>
    </div>
  );
}
