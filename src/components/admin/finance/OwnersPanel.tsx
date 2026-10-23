"use client";

import { useState } from "react";
import { createStockOwner, deleteStockOwner, saveStockOwner } from "@/actions/admin-finance";
import { useServerForm } from "./useServerForm";
import { RowActions } from "./RowActions";
import { Field, btnGhost, btnPrimary, inputCls } from "./ui";

export type OwnerRow = { id: string; name: string; contact: string; notes: string; expenseCount: number };

function OwnerForm({ initial, onDone }: { initial?: OwnerRow; onDone: () => void }) {
  const { state, pending, onSubmit } = useServerForm(initial ? saveStockOwner : createStockOwner, onDone);
  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 desktop:grid-cols-[1fr_1fr_1.4fr_auto]">
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <Field label="NAME">
        <input name="name" required maxLength={100} defaultValue={initial?.name} placeholder="Owner's name" className={inputCls} />
      </Field>
      <Field label="CONTACT (OPTIONAL)">
        <input name="contact" maxLength={120} defaultValue={initial?.contact} className={inputCls} />
      </Field>
      <Field label="NOTES (OPTIONAL)">
        <input name="notes" maxLength={300} defaultValue={initial?.notes} className={inputCls} />
      </Field>
      <div className="flex items-end gap-2">
        <button type="submit" disabled={pending} className={btnPrimary}>
          {pending ? "Saving…" : initial ? "Save" : "Add owner"}
        </button>
        {initial && (
          <button type="button" onClick={onDone} className={btnGhost}>
            Cancel
          </button>
        )}
      </div>
      {state && !state.ok && (
        <p role="alert" className="text-[13px] text-error sm:col-span-2 desktop:col-span-4">
          {state.error}
        </p>
      )}
    </form>
  );
}

/** The owners an expense can be marked "paid by". Carried over from the old Investments page. */
export function OwnersPanel({ owners }: { owners: OwnerRow[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [addKey, setAddKey] = useState(0);
  return (
    <details className="mb-4.5 border border-line bg-panel">
      <summary className="font-impact cursor-pointer select-none px-4.5 py-3.5 text-[17px] uppercase tracking-[0.5px]">
        Owners — who pays the expenses <span className="font-body text-[13px] normal-case tracking-normal text-muted">({owners.length})</span>
      </summary>
      <div className="space-y-3 border-t border-line p-4.5">
        <OwnerForm key={addKey} onDone={() => setAddKey((k) => k + 1)} />
        {owners.length > 0 && (
          <ul className="divide-y divide-line border border-line">
            {owners.map((o) =>
              editing === o.id ? (
                <li key={o.id} className="p-3">
                  <OwnerForm initial={o} onDone={() => setEditing(null)} />
                </li>
              ) : (
                <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 text-sm">
                  <div>
                    <span className="font-medium">{o.name}</span>
                    <span className="ml-2 text-[12px] text-muted">{[o.contact, o.notes].filter(Boolean).join(" · ")}</span>
                    <span className="ml-2 text-[12px] text-muted-2">
                      {o.expenseCount} expense{o.expenseCount === 1 ? "" : "s"}
                    </span>
                  </div>
                  <RowActions
                    onEdit={() => setEditing(o.id)}
                    onDelete={() => deleteStockOwner(o.id)}
                    confirmTitle="Delete this owner?"
                    confirmText={`Delete ${o.name}? An owner who has paid expenses can't be deleted — you'll be told if that is the case.`}
                  />
                </li>
              ),
            )}
          </ul>
        )}
      </div>
    </details>
  );
}
