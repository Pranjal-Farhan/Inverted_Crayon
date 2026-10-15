"use client";

import { useState } from "react";
import { saveInvestment, deleteInvestment, createStockOwner, saveStockOwner, deleteStockOwner } from "@/actions/admin-finance";
import { Panel } from "@/components/admin/Panel";
import { useServerForm } from "./useServerForm";
import { Field, Money, EmptyRow, RowActions, METHOD_OPTIONS, inputCls, btnGhost, btnPrimary } from "./ui-client";

export type InvestmentRow = { id: string; date: string; amount: number; ownerId: string; ownerName: string; description: string; method: string; notes: string };
export type OwnerRow = { id: string; name: string; contact: string; notes: string; invested: number; stockPaid: number; share: number; profitShare: number };

function InvestmentForm({ initial, owners, today, onDone }: { initial?: InvestmentRow; owners: { id: string; name: string }[]; today: string; onDone: () => void }) {
  const { state, pending, onSubmit } = useServerForm(saveInvestment, onDone);
  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2 desktop:grid-cols-4">
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <Field label="DATE">
        <input type="date" name="date" required defaultValue={initial?.date ?? today} className={inputCls} />
      </Field>
      <Field label="AMOUNT (৳)">
        <input type="number" name="amount" required min="0.01" step="0.01" inputMode="decimal" defaultValue={initial?.amount} placeholder="0.00" className={inputCls} />
      </Field>
      <Field label="INVESTED BY">
        <select name="ownerId" required defaultValue={initial?.ownerId ?? ""} className={inputCls}>
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
      <Field label="HOW IT CAME IN">
        <select name="method" defaultValue={initial?.method ?? "CASH"} className={inputCls}>
          {METHOD_OPTIONS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </Field>
      <Field label="DESCRIPTION (OPTIONAL)" className="sm:col-span-2">
        <input name="description" maxLength={140} defaultValue={initial?.description} placeholder="e.g. Starting capital, Extra money for the winter drop" className={inputCls} />
      </Field>
      <Field label="NOTES (OPTIONAL)" className="sm:col-span-2">
        <input name="notes" maxLength={500} defaultValue={initial?.notes} className={inputCls} />
      </Field>
      <div className="flex flex-wrap items-center gap-2.5 sm:col-span-2 desktop:col-span-4">
        <button type="submit" disabled={pending} className={btnPrimary}>
          {pending ? "Saving…" : initial ? "Save changes" : "Add investment"}
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

export function InvestmentsManager({ rows, owners, today, total }: { rows: InvestmentRow[]; owners: OwnerRow[]; today: string; total: number }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [editingOwner, setEditingOwner] = useState<string | null>(null);
  const [addKey, setAddKey] = useState(0);
  const [ownerKey, setOwnerKey] = useState(0);

  return (
    <div>
      <p className="mb-3.5 text-[13px] text-muted">
        An investment is money an owner or partner puts into the business. It is not income and not an expense — it adds to your cash and to that owner&apos;s share. (Stock you buy goes under{" "}
        <span className="text-paper">Stock &amp; owners</span>.)
      </p>

      <Panel title="Record an investment" className="mb-4.5">
        <InvestmentForm key={addKey} owners={owners} today={today} onDone={() => setAddKey((k) => k + 1)} />
      </Panel>

      <Panel className="mb-4.5 !p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-line-2 text-left text-muted">
                {["Date", "Invested by", "Details", "How", "Amount", ""].map((h, i) => (
                  <th key={i} className={`font-label px-4 py-2.5 text-[13px] tracking-[0.8px] ${h === "Amount" ? "text-right" : ""}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) =>
                editing === r.id ? (
                  <tr key={r.id} className="border-b border-line bg-panel-2/40">
                    <td colSpan={6} className="p-4">
                      <InvestmentForm initial={r} owners={owners} today={today} onDone={() => setEditing(null)} />
                    </td>
                  </tr>
                ) : (
                  <tr key={r.id} className="border-b border-line align-top">
                    <td className="whitespace-nowrap px-4 py-3">{r.date}</td>
                    <td className="px-4 py-3">{r.ownerName}</td>
                    <td className="px-4 py-3">
                      <div>{r.description || <span className="text-muted-2">—</span>}</div>
                      {r.notes && <div className="mt-0.5 text-[12px] text-muted">{r.notes}</div>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted">{METHOD_OPTIONS.find(([v]) => v === r.method)?.[1] ?? r.method}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <Money value={r.amount} tone="in" />
                    </td>
                    <td className="px-4 py-3">
                      <RowActions onEdit={() => setEditing(r.id)} onDelete={() => deleteInvestment(r.id)} confirmText={`Delete this investment by ${r.ownerName}? It will no longer count in the cash balance or the owner's share.`} />
                    </td>
                  </tr>
                ),
              )}
              {rows.length === 0 && <EmptyRow cols={6}>No investments in this period.</EmptyRow>}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="border-t border-line-2">
                  <td colSpan={4} className="font-label px-4 py-3 text-[13px] tracking-[0.8px] text-muted">
                    TOTAL ({rows.length})
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    <Money value={total} tone="in" />
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Panel>

      <Panel title="Owners & their capital">
        <p className="mb-3 text-[13px] text-muted">
          Each owner&apos;s share of the profit follows the money they have put in (all time). Add everyone who has invested here before recording their investment.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-line-2 text-left text-muted">
                {["Owner", "Invested", "Share", "Profit share so far", "Stock paid for", ""].map((h, i) => (
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
                    <td colSpan={6} className="p-3">
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
                    </td>
                    <td className="px-3 py-2.5">{(o.share * 100).toFixed(1)}%</td>
                    <td className="px-3 py-2.5">
                      <Money value={o.profitShare} />
                    </td>
                    <td className="px-3 py-2.5">
                      <Money value={o.stockPaid} tone="plain" />
                    </td>
                    <td className="px-3 py-2.5">
                      <RowActions onEdit={() => setEditingOwner(o.id)} onDelete={() => deleteStockOwner(o.id)} confirmText={`Remove ${o.name}?`} />
                    </td>
                  </tr>
                ),
              )}
              {owners.length === 0 && <EmptyRow cols={6}>No owners yet — add the first one below.</EmptyRow>}
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
