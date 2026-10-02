"use client";

import { useState, useTransition } from "react";
import { setVariantStock } from "@/actions/admin-inventory";

/** Live stock editor for an already-saved variant — writes straight to the database per
 * click/edit via setVariantStock (the same action Inventory uses), instead of going through
 * the product form's own bulk save (which deliberately never touches stockQty for existing
 * variants, to avoid clobbering a live count with a stale page-load snapshot). */
export function VariantStockStepper({ variantId, initialStock }: { variantId: string; initialStock: number }) {
  const [value, setValue] = useState(initialStock);
  const [pending, startTransition] = useTransition();

  function change(next: number) {
    const clamped = Math.max(0, Math.round(next));
    setValue(clamped);
    startTransition(() => {
      setVariantStock(variantId, clamped);
    });
  }

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => change(value - 1)}
        disabled={pending || value <= 0}
        aria-label="Decrease stock"
        className="h-6 w-6 border border-line-2 text-sm leading-none hover:border-lime disabled:opacity-40"
      >
        −
      </button>
      <input
        type="number"
        value={value}
        onChange={(e) => change(Number(e.target.value))}
        disabled={pending}
        className="w-12 border border-line-2 bg-ink px-1 py-1 text-center text-[13px] outline-none focus:border-lime disabled:opacity-60"
      />
      <button
        type="button"
        onClick={() => change(value + 1)}
        disabled={pending}
        aria-label="Increase stock"
        className="h-6 w-6 border border-line-2 text-sm leading-none hover:border-lime disabled:opacity-40"
      >
        +
      </button>
    </div>
  );
}
