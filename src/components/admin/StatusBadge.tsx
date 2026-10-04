import { ADMIN_STATUS_LABEL } from "@/lib/order-status";

const TONE: Record<string, string> = {
  paid: "bg-lime/[0.16] text-lime",
  ship: "bg-cyan/[0.16] text-cyan",
  pend: "bg-yellow/[0.16] text-yellow",
  ref: "bg-error/[0.16] text-error",
};

const STATUS_TONE: Record<string, keyof typeof TONE> = {
  PENDING: "pend",
  PAID: "paid",
  PROCESSING: "ship",
  SHIPPED: "ship",
  DELIVERED: "paid",
  CANCELLED: "ref",
  REFUNDED: "ref",
  RETURNED: "ref",
  Active: "paid",
  Scheduled: "pend",
  Draft: "pend",
};

export function StatusBadge({ status }: { status: string }) {
  const tone = STATUS_TONE[status] ?? "pend";
  // ADMIN_STATUS_LABEL only has entries for OrderStatus values — every other status this shared
  // badge renders (review/discount/campaign/journal/product states) falls through to the raw text.
  const label = ADMIN_STATUS_LABEL[status as keyof typeof ADMIN_STATUS_LABEL] ?? status;
  return (
    <span className={`font-label inline-block px-2.5 py-0.5 text-[12px] tracking-[0.8px] ${TONE[tone]}`}>
      {label}
    </span>
  );
}
