"use client";

import { useState, useTransition } from "react";
import {
  markOrderShipped,
  markOrderDelivered,
  markOrderProcessing,
  refundOrder,
  updateOrderNotes,
} from "@/actions/admin-orders";

export function OrderActions({ orderId, status, notes }: { orderId: string; status: string; notes: string }) {
  const [pending, startTransition] = useTransition();
  const [shipOpen, setShipOpen] = useState(false);
  const [courier, setCourier] = useState("Pathao");
  const [ref, setRef] = useState("");
  const [noteText, setNoteText] = useState(notes);

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {status === "PAID" && (
          <button
            disabled={pending}
            onClick={() => startTransition(() => markOrderProcessing(orderId))}
            className="border border-line-2 px-3.5 py-2 text-sm hover:border-lime disabled:opacity-50"
          >
            Mark processing
          </button>
        )}
        {(status === "PAID" || status === "PROCESSING") && (
          <button
            onClick={() => setShipOpen((o) => !o)}
            className="btn-primary bg-lime px-3.5 py-2 font-impact text-sm text-ink"
          >
            Mark shipped
          </button>
        )}
        {status === "SHIPPED" && (
          <button
            disabled={pending}
            onClick={() => startTransition(() => markOrderDelivered(orderId))}
            className="btn-primary bg-lime px-3.5 py-2 font-impact text-sm text-ink disabled:opacity-50"
          >
            Mark delivered
          </button>
        )}
        {status !== "REFUNDED" && status !== "CANCELLED" && (
          <button
            disabled={pending}
            onClick={() => {
              if (confirm("Refund this order? Stock will be restored.")) {
                startTransition(() => refundOrder(orderId));
              }
            }}
            className="border border-line-2 px-3.5 py-2 text-sm text-error hover:border-error disabled:opacity-50"
          >
            Refund
          </button>
        )}
      </div>

      {shipOpen && (
        <div className="mt-3 flex flex-wrap items-end gap-2.5 border border-line bg-panel-2 p-3.5">
          <div>
            <label className="font-label mb-1 block text-[12px] tracking-[1px] text-muted">Courier</label>
            <input value={courier} onChange={(e) => setCourier(e.target.value)} className="border border-line-2 bg-ink px-2.5 py-1.5 text-sm outline-none focus:border-lime" />
          </div>
          <div>
            <label className="font-label mb-1 block text-[12px] tracking-[1px] text-muted">Tracking ref</label>
            <input value={ref} onChange={(e) => setRef(e.target.value)} className="border border-line-2 bg-ink px-2.5 py-1.5 text-sm outline-none focus:border-lime" />
          </div>
          <button
            disabled={pending || !ref}
            onClick={() =>
              startTransition(async () => {
                await markOrderShipped(orderId, courier, ref);
                setShipOpen(false);
              })
            }
            className="btn-primary bg-lime px-3.5 py-1.5 font-impact text-sm text-ink disabled:opacity-50"
          >
            Confirm
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
          onClick={() => startTransition(() => updateOrderNotes(orderId, noteText))}
          className="mt-1.5 border border-line-2 px-3 py-1.5 text-[13px] hover:border-lime disabled:opacity-50"
        >
          Save note
        </button>
      </div>
    </div>
  );
}
