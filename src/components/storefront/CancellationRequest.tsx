"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { requestOrderCancellation } from "@/actions/customer-orders";

/** "Request cancellation" for an order that hasn't shipped — asks for an optional reason, then
 * tells the team. Once sent, the order page itself (server-rendered) shows the confirmation. */
export function CancellationRequest({ orderNumber }: { orderNumber: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-4 border border-line-2 px-4 py-2 text-sm text-muted hover:border-error hover:text-error"
      >
        Request cancellation
      </button>
    );
  }

  return (
    <div className="mt-4 border border-line bg-panel p-4">
      <p className="font-label text-[13px] tracking-[1.2px] text-muted">CANCEL THIS ORDER?</p>
      <p className="mt-1 text-[13px] text-muted">
        We&apos;ll let the team know. Nothing is cancelled until they confirm it with you.
      </p>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={500}
        rows={3}
        placeholder="Why do you want to cancel? (optional)"
        className="mt-3 w-full border border-line-2 bg-ink px-3 py-2 text-sm outline-none focus:border-lime"
      />
      {error && <p className="mt-2 text-[13px] text-error">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const res = await requestOrderCancellation(orderNumber, reason);
              if (!res.ok) {
                setError(res.error);
                return;
              }
              router.refresh();
            })
          }
          className="bg-error px-4 py-2 text-sm font-medium text-ink disabled:opacity-50"
        >
          {pending ? "Sending…" : "Send request"}
        </button>
        <button onClick={() => setOpen(false)} className="border border-line-2 px-4 py-2 text-sm">
          Never mind
        </button>
      </div>
    </div>
  );
}
