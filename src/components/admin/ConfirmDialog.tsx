"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

/**
 * An in-app confirmation popup for destructive admin actions — used instead of the browser's
 * `window.confirm`, which is a small unstyled box that's easy to click through, and which some
 * browsers/in-app views silently suppress (in which case the action would run with no prompt).
 *
 * Cancel is focused when it opens, so a stray Enter or Space never confirms. Escape, a click
 * outside the box, and Cancel all dismiss it (unless `busy`, i.e. the action is already running).
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  busyLabel = "Working…",
  cancelLabel = "Cancel",
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  confirmLabel: string;
  busyLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const descId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const returnFocusTo = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;
    returnFocusTo.current = document.activeElement;
    cancelRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) {
        e.stopPropagation();
        onCancel();
      } else if (e.key === "Tab") {
        // Keep keyboard focus inside the popup: it has exactly two controls.
        const first = cancelRef.current;
        const last = confirmRef.current;
        if (!first || !last) return;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = previousOverflow;
      if (returnFocusTo.current instanceof HTMLElement) returnFocusTo.current.focus();
    };
  }, [open, busy, onCancel]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[400] grid place-items-center bg-black/75 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="w-full max-w-[440px] border border-line-2 border-t-[4px] border-t-error bg-panel p-6 shadow-2xl"
      >
        <h2 id={titleId} className="font-impact text-[22px] uppercase leading-tight text-paper">
          {title}
        </h2>
        <div id={descId} className="mt-3 space-y-2 text-sm leading-relaxed text-muted">
          {children}
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="border border-line-2 px-5 py-2.5 text-sm text-paper hover:border-paper disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="bg-error px-5 py-2.5 font-impact text-sm uppercase tracking-wide text-white hover:brightness-110 disabled:opacity-60"
          >
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
