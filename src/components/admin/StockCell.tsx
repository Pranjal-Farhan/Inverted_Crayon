"use client";

import { useState, useTransition } from "react";
import { setVariantStock } from "@/actions/admin-inventory";

export function StockCell({ variantId, stockQty }: { variantId: string; stockQty: number }) {
  const [value, setValue] = useState(stockQty);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        className="w-16 border border-line-2 bg-ink px-2 py-1 text-sm outline-none focus:border-lime"
      />
      {value !== stockQty && (
        <button
          disabled={pending}
          onClick={() => startTransition(() => setVariantStock(variantId, value))}
          className="text-[12px] text-lime hover:underline disabled:opacity-50"
        >
          Save
        </button>
      )}
    </div>
  );
}
