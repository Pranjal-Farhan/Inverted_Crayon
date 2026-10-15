"use client";

import { useMemo, useRef, useState } from "react";
import { recordStockPurchase } from "@/actions/admin-finance";
import { Panel } from "@/components/admin/Panel";
import { useServerForm } from "@/components/admin/finance/useServerForm";
import { ProductPicker } from "@/components/admin/finance/ProductPicker";

export function StockPurchaseForm({
  owners,
  variants,
}: {
  owners: { id: string; name: string }[];
  variants: { id: string; label: string }[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [variantId, setVariantId] = useState("");
  const { state, pending, onSubmit } = useServerForm(recordStockPurchase, () => {
    formRef.current?.reset();
    setVariantId("");
  });
  const pickerOptions = useMemo(() => variants.map((v) => ({ id: v.id, label: v.label })), [variants]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <Panel title="Record a stock purchase">
      <form ref={formRef} onSubmit={onSubmit} className="grid grid-cols-1 gap-2.5 desktop:grid-cols-3">
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
        <ProductPicker className="desktop:col-span-2" name="variantId" ariaLabel="Product variant" placeholder="Search products — name, size, colour or SKU…" options={pickerOptions} value={variantId} onChange={setVariantId} />
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
