"use client";

import { useRouter, usePathname } from "next/navigation";
import type { PLPSort } from "@/lib/plp";

const OPTIONS: { value: PLPSort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price ↑" },
  { value: "price-desc", label: "Price ↓" },
  { value: "bestselling", label: "Bestselling" },
];

export function SortSelect({ current, queryString }: { current: PLPSort; queryString: string }) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <select
      value={current}
      onChange={(e) => {
        const sp = new URLSearchParams(queryString);
        sp.set("sort", e.target.value);
        sp.delete("page");
        router.push(`${pathname}?${sp.toString()}`);
      }}
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
