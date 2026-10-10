import { DEFAULT_MARQUEE } from "@/lib/marquee-defaults";

/** Endless scrolling brand strip, pure CSS animation (no client JS needed). Headlines are admin-editable from /admin/content ("Marquee ticker" panel) — `lines` falls back to the default set if the admin hasn't configured any yet. */
export function MarqueeTicker({ lines = DEFAULT_MARQUEE.lines }: { lines?: string[] }) {
  const track = (
    <span className="flex shrink-0 items-center gap-10 pr-10">
      {lines.map((line, i) => (
        <span key={i} className="flex items-center gap-10 whitespace-nowrap font-impact text-[15px] uppercase tracking-[1px]">
          {line}
          <span aria-hidden className="text-lime">
            ·
          </span>
        </span>
      ))}
    </span>
  );

  return (
    <div className="overflow-hidden border-b border-line-2 bg-panel-2 py-2.5" aria-hidden="true">
      <div className="marquee-track">
        {track}
        {track}
      </div>
    </div>
  );
}
