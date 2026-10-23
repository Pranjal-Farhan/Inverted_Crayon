"use client";

import { useState, useTransition } from "react";
import { addStock, removeStock, setStockTo } from "@/actions/admin-stock";
import { attempt } from "@/lib/attempt";

/**
 * Live stock editor for an already-saved variant in the product editor. It never writes an absolute
 * number it merely believes is right: − and + move the count by one (a delta the server applies
 * atomically), and typing a number is a stock-take that the server refuses if the count changed in
 * the meantime. Whatever the server answers is the count shown, and any refusal is shown in words.
 * (Bigger changes and the history live on the Inventory screen.)
 */
export function VariantStockStepper({ variantId, initialStock }: { variantId: string; initialStock: number }) {
  const [value, setValue] = useState(initialStock);
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<{ ok: boolean; error: string; qty?: number }>) {
    setError("");
    startTransition(async () => {
      const r = await attempt(action);
      if (r.ok && r.qty != null) setValue(r.qty);
      if (!r.ok) setError(r.error);
      setDraft(null);
    });
  }

  function commitTyped() {
    if (draft === null) return;
    const n = Number(draft);
    if (draft.trim() === "" || !Number.isInteger(n) || n < 0) {
      setError("Enter a whole number, zero or more.");
      setDraft(null);
      return;
    }
    if (n === value) return setDraft(null);
    run(() => setStockTo(variantId, value, n, "Edited in the product editor"));
  }

  return (
    <div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => run(() => removeStock(variantId, 1, "Stepper −1 in the product editor"))}
          disabled={pending || value <= 0}
          aria-label="Decrease stock by one"
          className="h-6 w-6 border border-line-2 text-sm leading-none hover:border-lime disabled:opacity-40"
        >
          −
        </button>
        <input
          type="number"
          min={0}
          value={draft ?? value}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitTyped}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitTyped();
            }
          }}
          disabled={pending}
          aria-label="Stock count"
          className="w-12 border border-line-2 bg-ink px-1 py-1 text-center text-[13px] outline-none focus:border-lime disabled:opacity-60"
        />
        <button
          type="button"
          onClick={() => run(() => addStock(variantId, 1, "Stepper +1 in the product editor"))}
          disabled={pending}
          aria-label="Increase stock by one"
          className="h-6 w-6 border border-line-2 text-sm leading-none hover:border-lime disabled:opacity-40"
        >
          +
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-0.5 max-w-[220px] text-[11px] leading-snug text-error">
          {error}
        </p>
      )}
    </div>
  );
}
