"use client";

import { useState, useTransition } from "react";
import { btnDanger, btnGhost } from "./ui";

/** Edit / Delete buttons for a table row. Delete asks first and reports a refusal (e.g. "stock already sold") in place. */
export function RowActions({
  onEdit,
  onDelete,
  confirmText,
  editLabel = "Edit",
}: {
  onEdit?: () => void;
  onDelete: () => Promise<{ ok: boolean; error: string }>;
  confirmText: string;
  editLabel?: string;
}) {
  const [pending, start] = useTransition();
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
            if (!confirm(confirmText)) return;
            setError("");
            start(async () => {
              const r = await onDelete();
              if (!r.ok) setError(r.error);
            });
          }}
        >
          {pending ? "Deleting…" : "Delete"}
        </button>
      </div>
      {error && (
        <p role="alert" className="max-w-[300px] text-right text-[12px] text-error">
          {error}
        </p>
      )}
    </div>
  );
}
