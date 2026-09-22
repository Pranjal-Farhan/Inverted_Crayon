"use client";

import { useMemo, useState, useTransition } from "react";
import { requestReturn } from "@/actions/customer-profile";

type OrderOption = {
  id: string;
  number: string;
  items: { id: string; productTitleSnapshot: string; variantLabelSnapshot: string }[];
};

export function ReturnRequestForm({ orders }: { orders: OrderOption[] }) {
  const [orderId, setOrderId] = useState(orders[0]?.id ?? "");
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [reason, setReason] = useState("Wrong size");
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  const order = useMemo(() => orders.find((o) => o.id === orderId), [orders, orderId]);

  if (orders.length === 0) {
    return <p className="text-sm text-muted">No delivered orders eligible for return yet.</p>;
  }

  if (done) {
    return <p className="text-lime text-sm">Return request submitted — we&apos;ll email you next steps.</p>;
  }

  return (
    <div className="border border-line bg-panel p-4.5">
      <h3 className="font-impact mb-3.5 text-lg uppercase">Request a return</h3>
      <label className="font-label mb-1 block text-[12px] tracking-[1px] text-muted">Order</label>
      <select
        value={orderId}
        onChange={(e) => {
          setOrderId(e.target.value);
          setSelectedItems([]);
        }}
        className="mb-3 w-full border border-line-2 bg-ink px-2.5 py-2 text-sm"
      >
        {orders.map((o) => (
          <option key={o.id} value={o.id}>
            #{o.number} · delivered
          </option>
        ))}
      </select>

      {order?.items.map((item) => (
        <label key={item.id} className="mb-1.5 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={selectedItems.includes(item.id)}
            onChange={(e) =>
              setSelectedItems((ids) => (e.target.checked ? [...ids, item.id] : ids.filter((id) => id !== item.id)))
            }
          />
          {item.productTitleSnapshot} · {item.variantLabelSnapshot}
        </label>
      ))}

      <label className="font-label mb-1 mt-2.5 block text-[12px] tracking-[1px] text-muted">Reason</label>
      <select value={reason} onChange={(e) => setReason(e.target.value)} className="mb-3 w-full border border-line-2 bg-ink px-2.5 py-2 text-sm">
        <option>Wrong size</option>
        <option>Changed mind</option>
        <option>Defective</option>
      </select>

      <button
        disabled={pending || selectedItems.length === 0}
        onClick={() =>
          startTransition(async () => {
            await requestReturn({ orderId, orderItemIds: selectedItems, reason });
            setDone(true);
          })
        }
        className="btn-primary bg-lime px-4 py-2 font-impact text-sm text-ink disabled:opacity-50"
      >
        Submit return
      </button>
    </div>
  );
}
