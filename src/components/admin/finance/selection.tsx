"use client";

import { useState, useTransition } from "react";
import { btnDanger, btnGhost } from "./ui";

/** Which rows are ticked, for the "delete several at once" bars. */
export function useSelection(allIds: string[]) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  // Rows that disappeared (deleted, filtered out) can't stay ticked.
  const ids = allIds.filter((id) => picked.has(id));
  return {
    ids,
    count: ids.length,
    has: (id: string) => picked.has(id),
    toggle: (id: string) =>
      setPicked((s) => {
        const n = new Set(s);
        if (n.has(id)) n.delete(id);
        else n.add(id);
        return n;
      }),
    allTicked: allIds.length > 0 && ids.length === allIds.length,
    toggleAll: () => setPicked((s) => (allIds.length > 0 && allIds.every((id) => s.has(id)) ? new Set() : new Set(allIds))),
    clear: () => setPicked(new Set()),
  };
}

export function RowCheck({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return <input type="checkbox" checked={checked} onChange={onChange} aria-label={label} className="h-4 w-4 cursor-pointer accent-[#c3f53a]" />;
}

/**
 * The bar that appears when rows are ticked. Each button is one bulk action; it asks first and
 * shows any refusal (e.g. "some of that stock is already sold") right here.
 */
export function BulkBar({
  count,
  actions,
  onClear,
}: {
  count: number;
  actions: { label: string; confirmText: string; run: () => Promise<{ ok: boolean; error: string }>; danger?: boolean }[];
  onClear: () => void;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  if (count === 0) return null;
  return (
    <div className="mb-3 border border-lime/40 bg-lime/[0.07] px-3.5 py-2.5" role="region" aria-label="Selected rows">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="text-sm">
          <span className="font-medium text-lime">{count}</span> selected
        </span>
        {actions.map((a) => (
          <button
            key={a.label}
            type="button"
            disabled={pending}
            className={a.danger === false ? btnGhost : btnDanger}
            onClick={() => {
              if (!confirm(a.confirmText)) return;
              setError("");
              start(async () => {
                const r = await a.run();
                if (!r.ok) setError(r.error);
                else onClear();
              });
            }}
          >
            {pending ? "Working…" : a.label}
          </button>
        ))}
        <button type="button" onClick={onClear} className={btnGhost}>
          Clear selection
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-1.5 text-[13px] text-error">
          {error}
        </p>
      )}
    </div>
  );
}
