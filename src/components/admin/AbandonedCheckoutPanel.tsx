"use client";

import { useTransition } from "react";
import { sendAbandonedReminder, sendAllAbandonedReminders } from "@/actions/admin-marketing";
import { Panel } from "@/components/admin/Panel";
import { formatTaka } from "@/lib/money";

type Row = {
  id: string;
  email: string;
  total: number;
  itemCount: number;
  createdAt: string;
  remindedAt: string | null;
};

export function AbandonedCheckoutPanel({ rows }: { rows: Row[] }) {
  const [pending, startTransition] = useTransition();

  return (
    <Panel title="Abandoned checkouts">
      <p className="mb-3 text-[13px] text-muted">
        Captured when a shopper enters their email at checkout but doesn&apos;t complete the order.
      </p>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line-2 text-left text-muted">
            {["Email", "Bag", "Started", "Reminded", ""].map((h) => (
              <th key={h} className="font-label pb-2 text-[13px] tracking-[0.8px]">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-line">
              <td className="py-2">{r.email}</td>
              <td className="py-2">
                {r.itemCount} item{r.itemCount === 1 ? "" : "s"} · {formatTaka(r.total)}
              </td>
              <td className="py-2">{new Date(r.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</td>
              <td className="py-2">{r.remindedAt ? "Yes" : "—"}</td>
              <td className="py-2 text-right">
                <button
                  disabled={pending}
                  onClick={() => startTransition(() => sendAbandonedReminder(r.id))}
                  className="text-cyan text-[13px] hover:underline disabled:opacity-50"
                >
                  {r.remindedAt ? "Resend" : "Send reminder"}
                </button>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="py-4 text-muted">
                Nothing captured yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {rows.some((r) => !r.remindedAt) && (
        <button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await sendAllAbandonedReminders();
            })
          }
          className="btn-primary mt-3 bg-lime px-4 py-2 font-impact text-sm text-ink disabled:opacity-50"
        >
          Send all pending reminders
        </button>
      )}
    </Panel>
  );
}
