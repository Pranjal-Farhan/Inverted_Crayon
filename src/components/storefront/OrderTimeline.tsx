import { CUSTOMER_STATUS_MESSAGE } from "@/lib/order-status";

const STEPS = ["PENDING", "PAID", "PROCESSING", "SHIPPED", "DELIVERED"] as const;
const LABELS: Record<(typeof STEPS)[number], string> = {
  PENDING: "Placed",
  PAID: "Paid",
  PROCESSING: "Processing",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
};

export function OrderTimeline({ status }: { status: string }) {
  const terminal = status === "CANCELLED" || status === "REFUNDED" || status === "RETURNED";
  const currentIndex = STEPS.indexOf(status as (typeof STEPS)[number]);
  const message = CUSTOMER_STATUS_MESSAGE[status as keyof typeof CUSTOMER_STATUS_MESSAGE];

  if (terminal) {
    return (
      <p className="font-label text-sm tracking-[1px] text-error">
        {message ?? `This order was ${status.toLowerCase()}.`}
      </p>
    );
  }

  return (
    <div>
      {message && <p className="font-label mb-3.5 text-sm tracking-[0.5px] text-paper">{message}</p>}
      <div className="flex gap-0">
        {STEPS.map((s, i) => {
          const done = currentIndex >= i;
          return (
            <div key={s} className="relative flex-1 text-center text-[12px] text-muted">
              {i > 0 && (
                <div
                  className={`absolute left-[-50%] top-[9px] h-0.5 w-full ${done ? "bg-lime" : "bg-line-2"}`}
                />
              )}
              <div className={`relative z-[1] mx-auto mb-1.5 h-[18px] w-[18px] rounded-full ${done ? "bg-lime" : "bg-line-2"}`} />
              <span className={done ? "text-paper" : ""}>{LABELS[s]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
