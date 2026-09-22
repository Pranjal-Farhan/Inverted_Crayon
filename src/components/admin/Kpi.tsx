const ACCENT: Record<string, string> = {
  lime: "border-t-lime",
  pink: "border-t-pink",
  cyan: "border-t-cyan",
  yellow: "border-t-yellow",
};

export function Kpi({
  label,
  value,
  delta,
  accent = "lime",
}: {
  label: string;
  value: string;
  delta?: string;
  accent?: keyof typeof ACCENT;
}) {
  return (
    <div className={`border border-line border-t-[3px] bg-panel p-4 ${ACCENT[accent]}`}>
      <div className="font-label text-[13px] tracking-[1.2px] text-muted">{label.toUpperCase()}</div>
      <div className="font-impact mt-1 text-[30px]">{value}</div>
      {delta && <div className="mt-0.5 text-xs text-lime">{delta}</div>}
    </div>
  );
}
