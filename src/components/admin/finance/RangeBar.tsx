import Link from "next/link";
import { PRESETS, rangeQuery, type DateRange } from "@/lib/finance-dates";

/**
 * "Show me …": preset periods as links plus a custom from/to. It's a plain GET form, so the chosen
 * period lives in the address (bookmarkable, printable) and `keep` carries any other filters along.
 */
export function RangeBar({ basePath, range, keep = {} }: { basePath: string; range: DateRange; keep?: Record<string, string | undefined> }) {
  const presetHref = (id: string) => {
    const sp = new URLSearchParams();
    if (id !== "this-month") sp.set("range", id);
    for (const [k, v] of Object.entries(keep)) if (v) sp.set(k, v);
    const s = sp.toString();
    return `${basePath}${s ? `?${s}` : ""}`;
  };
  return (
    <div className="mb-4.5 border border-line bg-panel p-3.5 print:hidden">
      <div className="flex flex-wrap items-center gap-1.5">
        {PRESETS.map((p) => (
          <Link
            key={p.id}
            href={presetHref(p.id)}
            prefetch={false}
            className={`border px-3 py-1.5 text-[13px] ${range.preset === p.id ? "border-lime text-lime" : "border-line-2 text-muted hover:border-lime"}`}
          >
            {p.label}
          </Link>
        ))}
      </div>
      <form method="get" action={basePath} className="mt-3 flex flex-wrap items-end gap-2.5">
        {Object.entries(keep).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
        <label className="block">
          <span className="font-label mb-1 block text-[12px] tracking-[1px] text-muted">FROM</span>
          <input type="date" name="from" defaultValue={range.from ?? ""} className="border border-line-2 bg-ink px-2.5 py-1.5 text-sm outline-none focus:border-lime" />
        </label>
        <label className="block">
          <span className="font-label mb-1 block text-[12px] tracking-[1px] text-muted">TO</span>
          <input type="date" name="to" defaultValue={range.to ?? ""} className="border border-line-2 bg-ink px-2.5 py-1.5 text-sm outline-none focus:border-lime" />
        </label>
        <button type="submit" className="border border-line-2 px-3.5 py-1.5 text-sm hover:border-lime">
          Show this period
        </button>
        <span className="ml-auto text-[13px] text-muted">
          Showing: <span className="text-paper">{range.label}</span>
        </span>
      </form>
    </div>
  );
}

export { rangeQuery };
