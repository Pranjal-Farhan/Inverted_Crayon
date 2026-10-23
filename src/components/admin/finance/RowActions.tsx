"use client";

import { useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { btnDanger, btnGhost } from "./ui";
import { attempt } from "@/lib/attempt";

/** Edit / Delete buttons for a table row. Delete asks in a popup first and shows any refusal in place, in words. */
export function RowActions({
  onEdit,
  onDelete,
  confirmText,
  confirmTitle = "Delete this?",
  editLabel = "Edit",
}: {
  onEdit?: () => void;
  onDelete: () => Promise<{ ok: boolean; error: string }>;
  confirmText: string;
  confirmTitle?: string;
  editLabel?: string;
}) {
  const [pending, start] = useTransition();
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-1.5">
        {onEdit && (
          <button type="button" onClick={onEdit} className={btnGhost}>
            {editLabel}
          </button>
        )}
        <button
          type="button"
          disabled={pending}
          className={btnDanger}
          onClick={() => {
            setError("");
            setAsking(true);
          }}
        >
          {pending ? "Deleting…" : "Delete"}
        </button>
      </div>
      <ConfirmDialog
        open={asking}
        title={confirmTitle}
        confirmLabel="Yes, delete"
        busyLabel="Deleting…"
        cancelLabel="No, keep it"
        busy={pending}
        onCancel={() => setAsking(false)}
        onConfirm={() =>
          start(async () => {
            const r = await attempt(onDelete);
            setAsking(false);
            if (!r.ok) setError(r.error);
          })
        }
      >
        <p>{confirmText}</p>
      </ConfirmDialog>
      {error && (
        <p role="alert" className="max-w-[300px] text-right text-[12px] text-error">
          {error}
        </p>
      )}
    </div>
  );
}
