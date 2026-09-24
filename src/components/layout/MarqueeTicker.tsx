const LINES = ["Free worldwide shipping", "Made to stand out", "14-day easy returns", "Not normal, never was"];

/** Endless scrolling brand strip, pure CSS animation (no client JS needed). */
export function MarqueeTicker() {
  const track = (
    <span className="flex shrink-0 items-center gap-10 pr-10">
      {LINES.map((line, i) => (
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
