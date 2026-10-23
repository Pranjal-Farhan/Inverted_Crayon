"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteRecordedSale } from "@/actions/admin-sales";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { RecordSaleForm, type RecordedSaleInitial } from "@/components/admin/RecordSaleForm";
import { btnDanger, btnGhost } from "@/components/admin/finance/ui";
import type { VariantOption } from "@/lib/variant-options";
import { attempt } from "@/lib/attempt";

/** Edit and delete for a recorded sale, on its own order page (admin accounts only). */
export function RecordedSaleAdmin({ initial, variants, today, canEditItems }: { initial: RecordedSaleInitial; variants: VariantOption[]; today: string; canEditItems: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  return (
    <div className="mt-4 border-t border-line pt-4">
      <div className="font-label mb-2 text-[12px] tracking-[1px] text-muted">RECORDED SALE</div>
      {!editing && (
        <div className="flex flex-wrap items-center gap-2">
          {canEditItems ? (
            <button type="button" onClick={() => setEditing(true)} className={btnGhost}>
              Edit this sale
            </button>
          ) : (
            <span className="text-[12px] text-muted">This sale was cancelled, refunded or returned, so it can no longer be edited.</span>
          )}
          <button
            type="button"
            onClick={() => {
              setError("");
              setAsking(true);
            }}
            className={btnDanger}
          >
            Delete this sale
          </button>
        </div>
      )}
      {editing && (
        <RecordSaleForm
          initial={initial}
          variants={variants}
          today={today}
          onDone={() => {
            setEditing(false);
            router.refresh();
          }}
        />
      )}
      {error && (
        <p role="alert" className="mt-2 border border-error/40 bg-error/[0.07] px-3 py-2 text-[13px] text-error">
          {error}
        </p>
      )}
      <ConfirmDialog
        open={asking}
        title="Delete this sale?"
        confirmLabel="Yes, delete it"
        busyLabel="Deleting…"
        cancelLabel="No, keep it"
        busy={pending}
        onCancel={() => setAsking(false)}
        onConfirm={() =>
          start(async () => {
            const r = await attempt(() => deleteRecordedSale(initial.id));
            setAsking(false);
            if (!r.ok) return setError(r.error);
            router.push("/admin/orders");
          })
        }
      >
        <p>
          Permanently delete sale <strong className="text-paper">{initial.number}</strong> to {initial.customerName}? Any stock it still holds goes back on the shelf, and it stops counting in Total Sales. This can&apos;t be undone.
        </p>
      </ConfirmDialog>
    </div>
  );
}
