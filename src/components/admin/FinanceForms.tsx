"use client";

import { useActionState, useRef, useEffect } from "react";
import { createStockOwner, recordStockPurchase } from "@/actions/admin-finance";
import { Panel } from "@/components/admin/Panel";

export function StockOwnerForm() {
  const [state, formAction, pending] = useActionState(createStockOwner, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <Panel title="Add a stock owner">
      <form ref={formRef} action={formAction} className="grid grid-cols-1 gap-2.5 desktop:grid-cols-3">
        <input name="name" placeholder="Owner name" required className="border border-line-2 bg-ink px-2.5 py-2 text-sm outline-none focus:border-lime" />
        <input name="contact" placeholder="Contact (phone/email)" className="border border-line-2 bg-ink px-2.5 py-2 text-sm outline-none focus:border-lime" />
        <input name="notes" placeholder="Notes" className="border border-line-2 bg-ink px-2.5 py-2 text-sm outline-none focus:border-lime" />
        <button type="submit" disabled={pending} className="btn-primary bg-lime px-4 py-2 font-impact text-sm text-ink disabled:opacity-50 desktop:col-span-3 desktop:w-fit">
          {pending ? "Adding…" : "Add owner"}
        </button>
        {state && !state.ok && <p className="text-[13px] text-error desktop:col-span-3">{state.error}</p>}
      </form>
    </Panel>
  );
}

export function StockPurchaseForm({
  owners,
  variants,
}: {
  owners: { id: string; name: string }[];
  variants: { id: string; label: string }[];
}) {
  const [state, formAction, pending] = useActionState(recordStockPurchase, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <Panel title="Record a stock purchase">
      <form ref={formRef} action={formAction} className="grid grid-cols-1 gap-2.5 desktop:grid-cols-3">
        <select name="ownerId" required defaultValue="" className="border border-line-2 bg-ink px-2.5 py-2 text-sm">
          <option value="" disabled>
            Owner (who paid)
          </option>
          {owners.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <select name="variantId" required defaultValue="" className="border border-line-2 bg-ink px-2.5 py-2 text-sm desktop:col-span-2">
          <option value="" disabled>
            Product variant
          </option>
          {variants.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>
        <input name="quantity" type="number" min={1} step={1} placeholder="Quantity" required className="border border-line-2 bg-ink px-2.5 py-2 text-sm outline-none focus:border-lime" />
        <input name="unitCost" type="number" min={0} step="0.01" placeholder="Unit cost (৳)" required className="border border-line-2 bg-ink px-2.5 py-2 text-sm outline-none focus:border-lime" />
        <input name="purchaseDate" type="date" defaultValue={today} className="border border-line-2 bg-ink px-2.5 py-2 text-sm outline-none focus:border-lime" />
        <input name="supplierName" placeholder="Supplier (optional)" className="border border-line-2 bg-ink px-2.5 py-2 text-sm outline-none focus:border-lime desktop:col-span-2" />
        <input name="notes" placeholder="Notes (optional)" className="border border-line-2 bg-ink px-2.5 py-2 text-sm outline-none focus:border-lime" />
        <button type="submit" disabled={pending} className="btn-primary bg-lime px-4 py-2 font-impact text-sm text-ink disabled:opacity-50 desktop:col-span-3 desktop:w-fit">
          {pending ? "Recording…" : "Record purchase"}
        </button>
        {state && !state.ok && <p className="text-[13px] text-error desktop:col-span-3">{state.error}</p>}
      </form>
    </Panel>
  );
}
