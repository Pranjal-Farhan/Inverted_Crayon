"use client";

import { useState, useTransition } from "react";
import {
  markOrderShipped,
  markOrderDelivered,
  refundOrder,
  cancelOrder,
  updateOrderNotes,
  markBalanceCollected,
  unmarkBalanceCollected,
} from "@/actions/admin-orders";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { attempt } from "@/lib/attempt";

type Ask = { title: string; text: string; label: string; run: () => Promise<{ ok: boolean; error: string }> };

/**
 * The buttons on an order's page. Every action answers with { ok, error }: when something can't be
 * done (the order has already moved on, not enough stock, a database hiccup…) the reason is shown
 * right here in words — nothing fails silently. Cancel, refund and undo ask in a popup first.
 */
export function OrderActions({
  orderId,
  status,
  notes,
  balanceDue,
  balanceCollected,
  cashCollectedOn,
  source = "ONLINE",
}: {
  orderId: string;
  status: string;
  notes: string;
  balanceDue?: number;
  balanceCollected?: boolean;
  /** Already formatted, e.g. "14 Oct 2026". */
  cashCollectedOn?: string | null;
  /** A sale recorded by hand can be sent without a tracking reference and delivered straight from "Not Cleared Yet". */
  source?: "ONLINE" | "RECORDED";
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [shipOpen, setShipOpen] = useState(false);
  const [courier, setCourier] = useState("Pathao");
  const [ref, setRef] = useState("");
  const [noteText, setNoteText] = useState(notes);
  const [ask, setAsk] = useState<Ask | null>(null);

  const recorded = source === "RECORDED";
  const notCleared = status === "PENDING" || status === "PAID" || status === "PROCESSING";

  function run(action: () => Promise<{ ok: boolean; error: string }>, done?: () => void) {
    setError("");
    setNotice("");
    startTransition(async () => {
      const r = await attempt(action);
      setAsk(null);
      if (!r.ok) return setError(r.error);
      done?.();
    });
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {Boolean(balanceDue) && balanceDue! > 0 && !balanceCollected && (
          <button disabled={pending} onClick={() => run(() => markBalanceCollected(orderId))} className="border border-yellow px-3.5 py-2 text-sm text-yellow hover:bg-yellow/[0.08] disabled:opacity-50">
            Mark cash collected
          </button>
        )}
        {balanceCollected && (
          <span className="flex items-center gap-2.5 border border-lime/40 bg-lime/[0.07] px-3.5 py-2 text-sm text-lime">
            ✓ Cash collected{cashCollectedOn ? ` on ${cashCollectedOn}` : ""}
            <button
              disabled={pending}
              onClick={() =>
                setAsk({
                  title: "Undo cash collected?",
                  text: "Mark this order's cash as NOT collected again?",
                  label: "Yes, undo it",
                  run: () => unmarkBalanceCollected(orderId),
                })
              }
              className="text-[12px] text-muted underline hover:text-paper disabled:opacity-50"
            >
              Undo
            </button>
          </span>
        )}
        {notCleared && (
          <button onClick={() => setShipOpen((o) => !o)} className="btn-primary bg-lime px-3.5 py-2 font-impact text-sm text-ink">
            Mark Sent For Delivery
          </button>
        )}
        {(status === "SHIPPED" || (recorded && notCleared)) && (
          <button disabled={pending} onClick={() => run(() => markOrderDelivered(orderId))} className="btn-primary bg-lime px-3.5 py-2 font-impact text-sm text-ink disabled:opacity-50">
            {pending ? "Working…" : "Mark delivered"}
          </button>
        )}
        {notCleared && (
          <button
            disabled={pending}
            onClick={() =>
              setAsk({
                title: "Cancel this order?",
                text: recorded
                  ? "Its stock goes back on the shelf. It will show as Cancelled and stop counting in Total Sales."
                  : "Its stock goes back on the shelf and the customer is emailed the cancellation.",
                label: "Yes, cancel it",
                run: () => cancelOrder(orderId),
              })
            }
            className="border border-line-2 px-3.5 py-2 text-sm text-error hover:border-error disabled:opacity-50"
          >
            Cancel order
          </button>
        )}
        {status !== "REFUNDED" && status !== "CANCELLED" && (
          <button
            disabled={pending}
            onClick={() =>
              setAsk({
                title: "Refund this order?",
                text: "Its stock goes back on the shelf and it stops counting in Total Sales.",
                label: "Yes, refund it",
                run: () => refundOrder(orderId),
              })
            }
            className="border border-line-2 px-3.5 py-2 text-sm text-error hover:border-error disabled:opacity-50"
          >
            Refund
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-2.5 border border-error/40 bg-error/[0.07] px-3 py-2 text-[13px] text-error">
          {error}
        </p>
      )}
      {notice && !error && (
        <p role="status" className="mt-2.5 text-[13px] text-lime">
          {notice}
        </p>
      )}

      {shipOpen && (
        <div className="mt-3 flex flex-wrap items-end gap-2.5 border border-line bg-panel-2 p-3.5">
          <div>
            <label className="font-label mb-1 block text-[12px] tracking-[1px] text-muted">Courier</label>
            <input value={courier} onChange={(e) => setCourier(e.target.value)} className="border border-line-2 bg-ink px-2.5 py-1.5 text-sm outline-none focus:border-lime" />
          </div>
          <div>
            <label className="font-label mb-1 block text-[12px] tracking-[1px] text-muted">Tracking ref{recorded ? " (optional)" : ""}</label>
            <input value={ref} onChange={(e) => setRef(e.target.value)} className="border border-line-2 bg-ink px-2.5 py-1.5 text-sm outline-none focus:border-lime" />
          </div>
          <button
            disabled={pending || (!recorded && !ref)}
            onClick={() => run(() => markOrderShipped(orderId, courier, ref), () => setShipOpen(false))}
            className="btn-primary bg-lime px-3.5 py-1.5 font-impact text-sm text-ink disabled:opacity-50"
          >
            {pending ? "Working…" : "Confirm"}
          </button>
        </div>
      )}

      <div className="mt-4">
        <label className="font-label mb-1.5 block text-[13px] tracking-[1.2px] text-muted">Internal notes</label>
        <textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          rows={2}
          placeholder="Internal note…"
          className="w-full border border-line-2 bg-ink px-3 py-2 text-sm outline-none focus:border-lime"
        />
        <button
          disabled={pending}
          onClick={() => run(() => updateOrderNotes(orderId, noteText), () => setNotice("Note saved."))}
          className="mt-1.5 border border-line-2 px-3 py-1.5 text-[13px] hover:border-lime disabled:opacity-50"
        >
          Save note
        </button>
      </div>

      <ConfirmDialog
        open={ask != null}
        title={ask?.title ?? ""}
        confirmLabel={ask?.label ?? "Yes"}
        busyLabel="Working…"
        cancelLabel="No, go back"
        busy={pending}
        onCancel={() => setAsk(null)}
        onConfirm={() => ask && run(ask.run)}
      >
        <p>{ask?.text}</p>
      </ConfirmDialog>
    </div>
  );
}
