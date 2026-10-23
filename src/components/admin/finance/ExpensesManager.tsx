"use client";

import { useState } from "react";
import { saveExpense, deleteExpense, deleteExpenses } from "@/actions/admin-finance";
import { Panel } from "@/components/admin/Panel";
import { useServerForm } from "./useServerForm";
import { BulkBar, RowCheck, useSelection } from "./selection";
import { Field, Money, EmptyRow, RowActions, METHOD_OPTIONS, inputCls, btnGhost, btnPrimary } from "./ui-client";

export type ExpenseRow = {
  id: string;
  date: string;
  amount: number;
  categoryId: string;
  category: string;
  title: string;
  paidTo: string;
  method: string;
  ownerId: string;
  ownerName: string;
  notes: string;
  createdBy: string;
};
type OwnerOption = { id: string; name: string };
type CategoryOption = { id: string; name: string };

function ExpenseForm({ initial, categories, owners, today, onDone }: { initial?: ExpenseRow; categories: CategoryOption[]; owners: OwnerOption[]; today: string; onDone: () => void }) {
  const { state, pending, onSubmit } = useServerForm(saveExpense, onDone);
  const noCategories = categories.length === 0;
  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2 desktop:grid-cols-4">
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <Field label="DATE">
        <input type="date" name="date" required defaultValue={initial?.date ?? today} className={inputCls} />
      </Field>
      <Field label="AMOUNT (৳)">
        <input type="number" name="amount" required min="0.01" step="0.01" inputMode="decimal" defaultValue={initial?.amount} placeholder="0.00" className={inputCls} />
      </Field>
      <Field label="CATEGORY">
        <select name="categoryId" required defaultValue={initial?.categoryId ?? ""} disabled={noCategories} className={inputCls}>
          <option value="">{noCategories ? "Create a category first (top right)" : "— Choose a category —"}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="PAID BY (OWNER)">
        <select name="ownerId" defaultValue={initial?.ownerId ?? ""} className={inputCls}>
          <option value="">{owners.length ? "— Not recorded —" : "No owners yet (add them below)"}</option>
          {owners.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="PAYMENT METHOD">
        <select name="method" defaultValue={initial?.method ?? "CASH"} className={inputCls}>
          {METHOD_OPTIONS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </Field>
      <Field label="WHAT WAS IT FOR">
        <input name="title" required maxLength={140} defaultValue={initial?.title} placeholder="e.g. Freight & customs — October shipment" className={inputCls} />
      </Field>
      <Field label="PAID TO (OPTIONAL)">
        <input name="paidTo" maxLength={120} defaultValue={initial?.paidTo} placeholder="Vendor / person" className={inputCls} />
      </Field>
      <Field label="NOTES (OPTIONAL)">
        <input name="notes" maxLength={500} defaultValue={initial?.notes} className={inputCls} />
      </Field>
      <div className="flex flex-wrap items-center gap-2.5 sm:col-span-2 desktop:col-span-4">
        <button type="submit" disabled={pending || noCategories} className={btnPrimary}>
          {pending ? "Saving…" : initial ? "Save changes" : "Add expense"}
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

/**
 * The expense form and the recorded expenses. Each expense is one row showing everything about it
 * on the surface — date, category, what it was for, notes, who it was paid to, how, which owner
 * paid, the amount and who recorded it — nothing is hidden behind a click.
 */
export function ExpensesManager({ rows, categories, owners, today, total }: { rows: ExpenseRow[]; categories: CategoryOption[]; owners: OwnerOption[]; today: string; total: number }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [addKey, setAddKey] = useState(0);
  const sel = useSelection(rows.map((r) => r.id));

  return (
    <div>
      <Panel title="Add an expense" className="mb-4.5">
        <ExpenseForm key={addKey} categories={categories} owners={owners} today={today} onDone={() => setAddKey((k) => k + 1)} />
        <p className="mt-3 text-[12px] text-muted-2">
          Don&apos;t enter the price of the products themselves — each product&apos;s Purchase cost is counted as the Buying Cost when it sells. Do enter what it costs to get stock here: freight, customs, handling, a courier for a shipment. Make a category for it (top right) and it appears in the list above.
        </p>
      </Panel>

      <BulkBar
        count={sel.count}
        onClear={sel.clear}
        actions={[{ label: `Delete ${sel.count} expense${sel.count === 1 ? "" : "s"}`, confirmText: `Permanently delete ${sel.count} expense${sel.count === 1 ? "" : "s"}? They will no longer count against your profit. This can't be undone.`, run: () => deleteExpenses(sel.ids) }]}
      />

      <Panel className="!p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-sm">
            <thead>
              <tr className="border-b border-line-2 text-left text-muted">
                <th className="w-9 px-4 py-2.5">
                  <RowCheck checked={sel.allTicked} onChange={sel.toggleAll} label="Select all expenses" />
                </th>
                {["Date", "Category", "What it was for", "Paid to", "Paid via", "Paid by (owner)", "Amount", ""].map((h, i) => (
                  <th key={i} className={`font-label px-3 py-2.5 text-[13px] tracking-[0.8px] ${h === "Amount" ? "text-right" : ""}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) =>
                editing === r.id ? (
                  <tr key={r.id} className="border-b border-line bg-panel-2/40">
                    <td colSpan={9} className="p-4">
                      <ExpenseForm initial={r} categories={categories} owners={owners} today={today} onDone={() => setEditing(null)} />
                    </td>
                  </tr>
                ) : (
                  <tr key={r.id} className="border-b border-line align-top">
                    <td className="px-4 py-3">
                      <RowCheck checked={sel.has(r.id)} onChange={() => sel.toggle(r.id)} label={`Select ${r.title}`} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">{r.date}</td>
                    <td className="px-3 py-3">
                      <span className="font-label inline-block whitespace-nowrap bg-pink/[0.14] px-2 py-0.5 text-[11px] tracking-[0.8px] text-pink">{r.category.toUpperCase()}</span>
                    </td>
                    <td className="max-w-[320px] px-3 py-3">
                      <div className="font-medium">{r.title}</div>
                      {r.notes && <div className="mt-0.5 text-[12px] text-muted">{r.notes}</div>}
                      {r.createdBy && <div className="mt-0.5 text-[11px] text-muted-2">recorded by {r.createdBy}</div>}
                    </td>
                    <td className="px-3 py-3">{r.paidTo || <span className="text-muted-2">—</span>}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-muted">{METHOD_OPTIONS.find(([v]) => v === r.method)?.[1] ?? r.method}</td>
                    <td className="whitespace-nowrap px-3 py-3">{r.ownerName || <span className="text-muted-2">—</span>}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-right">
                      <Money value={r.amount} tone="out" />
                    </td>
                    <td className="px-3 py-3">
                      <RowActions
                        onEdit={() => setEditing(r.id)}
                        onDelete={() => deleteExpense(r.id)}
                        confirmTitle="Delete this expense?"
                        confirmText={`Delete this expense (${r.title})? It will no longer count against your profit. This can't be undone.`}
                      />
                    </td>
                  </tr>
                ),
              )}
              {rows.length === 0 && <EmptyRow cols={9}>No expenses in this period. Add one above.</EmptyRow>}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="border-t border-line-2">
                  <td colSpan={7} className="font-label px-4 py-3 text-[13px] tracking-[0.8px] text-muted">
                    TOTAL ({rows.length} {rows.length === 1 ? "expense" : "expenses"})
                  </td>
                  <td className="px-3 py-3 text-right font-medium">
                    <Money value={total} tone="out" />
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Panel>
    </div>
  );
}
