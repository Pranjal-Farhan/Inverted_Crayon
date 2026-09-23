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
    <div className={`min-w-0 border border-line border-t-[3px] bg-panel p-4 ${ACCENT[accent]}`}>
      <div className="font-label text-[13px] tracking-[1.2px] text-muted">{label.toUpperCase()}</div>
      <div className="font-impact mt-1 break-words text-[22px] desktop:text-[30px]">{value}</div>
      {delta && <div className="mt-0.5 break-words text-xs text-lime">{delta}</div>}
    </div>
  );
}
