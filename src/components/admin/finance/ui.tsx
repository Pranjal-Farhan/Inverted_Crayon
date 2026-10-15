import { formatTakaPrecise } from "@/lib/money";

/** Shared look for the finance forms and tables. */
export const inputCls = "w-full border border-line-2 bg-ink px-2.5 py-2 text-sm outline-none focus:border-lime";
export const btnPrimary = "btn-primary bg-lime px-4 py-2 font-impact text-sm text-ink disabled:opacity-50";
export const btnGhost = "border border-line-2 px-3 py-1.5 text-[13px] text-muted hover:border-lime hover:text-paper disabled:opacity-50";
export const btnDanger = "border border-line-2 px-3 py-1.5 text-[13px] text-error hover:border-error disabled:opacity-50";

export function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="font-label mb-1 block text-[12px] tracking-[1px] text-muted">{label}</span>
      {children}
    </label>
  );
}

export function Money({ value, tone = "auto" }: { value: number; tone?: "auto" | "plain" | "in" | "out" }) {
  const cls = tone === "plain" ? "" : tone === "in" ? "text-lime" : tone === "out" ? "text-error" : value > 0 ? "text-lime" : value < 0 ? "text-error" : "";
  return <span className={`tabular-nums ${cls}`}>{formatTakaPrecise(value)}</span>;
}

const STATUS_TONE: Record<string, string> = {
  COMPLETED: "bg-lime/[0.16] text-lime",
  IN_PROGRESS: "bg-cyan/[0.16] text-cyan",
  UNPAID: "bg-yellow/[0.16] text-yellow",
  LOST: "bg-error/[0.16] text-error",
};

export function SaleStatusChip({ status, label }: { status: string; label: string }) {
  return (
    <span className={`font-label inline-block whitespace-nowrap px-2 py-0.5 text-[11px] tracking-[0.8px] ${STATUS_TONE[status] ?? ""}`}>
      {label.toUpperCase()}
    </span>
  );
}

const KIND_TONE: Record<string, string> = {
  SALE: "text-lime",
  EXPENSE: "text-error",
  INVESTMENT: "text-cyan",
  STOCK_PURCHASE: "text-yellow",
};
export function KindChip({ kind, label }: { kind: string; label: string }) {
  return <span className={`font-label whitespace-nowrap text-[12px] tracking-[0.8px] ${KIND_TONE[kind] ?? ""}`}>{label.toUpperCase()}</span>;
}

export const METHOD_OPTIONS = [
  ["CASH", "Cash"],
  ["BKASH", "bKash"],
  ["NAGAD", "Nagad"],
  ["BANK", "Bank transfer"],
  ["CARD", "Card"],
  ["OTHER", "Other"],
] as const;

export function EmptyRow({ cols, children }: { cols: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={cols} className="px-4 py-8 text-center text-muted">
        {children}
      </td>
    </tr>
  );
}
