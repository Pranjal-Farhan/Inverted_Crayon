"use client";

import type { PLPSort } from "@/lib/plp";

const OPTIONS: { value: PLPSort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price ↑" },
  { value: "price-desc", label: "Price ↓" },
  { value: "bestselling", label: "Bestselling" },
];

/**
 * Same control as SortSelect.tsx, but driven by a callback instead of router.push — the static
 * PLP pages (StaticPLPClient.tsx) update the URL via the History API directly, never through a
 * Next.js navigation, so they can't reuse SortSelect's router-based implementation as-is. Kept
 * as a separate component rather than widening SortSelect's prop API, so /search (which still
 * uses the original, server-filtered PLPView + SortSelect) can't be affected by this at all.
 */
export function StaticSortSelect({ current, onChange }: { current: PLPSort; onChange: (value: PLPSort) => void }) {
  return (
    <select
      value={current}
      onChange={(e) => onChange(e.target.value as PLPSort)}
      className="border border-line-2 bg-panel px-3 py-1.5 font-label text-[14px] tracking-[1px] text-muted"
    >
      {OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          SORT: {o.label.toUpperCase()}
        </option>
      ))}
    </select>
  );
}
