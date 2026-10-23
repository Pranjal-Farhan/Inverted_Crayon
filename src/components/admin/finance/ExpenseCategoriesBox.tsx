"use client";

import { useState, useTransition } from "react";
import { createExpenseCategory, deleteExpenseCategory, renameExpenseCategory } from "@/actions/admin-finance";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { btnGhost, btnPrimary, inputCls } from "./ui";
import { attempt } from "@/lib/attempt";

export type CategoryRow = { id: string; name: string; count: number };

/**
 * Top-right of the Expenses page: where expense categories are made. There is no built-in list — a
 * category exists only once it is created here, and then it shows up in the Category drop-downs
 * (the expense form, the filter). A category with expenses on it can be renamed but not deleted.
 */
export function ExpenseCategoriesBox({ categories }: { categories: CategoryRow[] }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);
  const [deleting, setDeleting] = useState<CategoryRow | null>(null);

  function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError("");
    setNotice("");
    start(async () => {
      const r = await attempt(() => createExpenseCategory(null, form));
      if (!r.ok) return setError(r.error);
      setNotice(`"${name.trim()}" created — it's now in the Category lists.`);
      setName("");
    });
  }

  function saveRename(c: CategoryRow) {
    setRowError(null);
    start(async () => {
      const r = await attempt(() => renameExpenseCategory(c.id, draft));
      if (!r.ok) return setRowError({ id: c.id, message: r.error });
      setEditing(null);
    });
  }

  return (
    <section className="border border-line border-t-[3px] border-t-lime bg-panel p-4" aria-labelledby="exp-cat-title">
      <h2 id="exp-cat-title" className="font-impact text-[16px] uppercase tracking-[0.5px]">
        New expense category
      </h2>
      <form onSubmit={create} className="mt-2.5 flex gap-2">
        <input
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          required
          placeholder="e.g. Rent, Ads, Freight & customs"
          aria-label="New category name"
          className={inputCls}
        />
        <button type="submit" disabled={pending} className={`${btnPrimary} whitespace-nowrap`}>
          {pending && editing === null ? "Adding…" : "Add"}
        </button>
      </form>
      {error && (
        <p role="alert" className="mt-1.5 text-[13px] text-error">
          {error}
        </p>
      )}
      {notice && !error && (
        <p role="status" className="mt-1.5 text-[13px] text-lime">
          {notice}
        </p>
      )}

      <div className="mt-3 border-t border-line pt-2.5">
        {categories.length === 0 ? (
          <p className="text-[13px] text-yellow">No categories yet — create your first one above. An expense can&apos;t be saved without a category.</p>
        ) : (
          <ul className="max-h-[210px] space-y-1 overflow-y-auto pr-1">
            {categories.map((c) => (
              <li key={c.id} className="text-sm">
                {editing === c.id ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      maxLength={60}
                      autoFocus
                      aria-label={`New name for ${c.name}`}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveRename(c);
                        if (e.key === "Escape") setEditing(null);
                      }}
                      className={`${inputCls} !py-1`}
                    />
                    <button type="button" disabled={pending} onClick={() => saveRename(c)} className={`${btnGhost} !text-lime`}>
                      Save
                    </button>
                    <button type="button" onClick={() => setEditing(null)} className={btnGhost}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate">
                      {c.name} <span className="text-[12px] text-muted-2">· {c.count}</span>
                    </span>
                    <span className="flex shrink-0 gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setRowError(null);
                          setDraft(c.name);
                          setEditing(c.id);
                        }}
                        className="text-[12px] text-muted underline hover:text-paper"
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRowError(null);
                          setDeleting(c);
                        }}
                        className="text-[12px] text-error underline"
                      >
                        Delete
                      </button>
                    </span>
                  </div>
                )}
                {rowError?.id === c.id && (
                  <p role="alert" className="mt-0.5 text-[12px] leading-snug text-error">
                    {rowError.message}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={deleting != null}
        title="Delete this category?"
        confirmLabel="Yes, delete it"
        busyLabel="Deleting…"
        cancelLabel="No, keep it"
        busy={pending}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          const c = deleting;
          if (!c) return;
          start(async () => {
            const r = await attempt(() => deleteExpenseCategory(c.id));
            setDeleting(null);
            if (!r.ok) setRowError({ id: c.id, message: r.error });
          });
        }}
      >
        <p>
          Delete the category <strong className="text-paper">{deleting?.name}</strong>? A category that has expenses on it can&apos;t be deleted — you&apos;ll be told if that is the case.
        </p>
      </ConfirmDialog>
    </section>
  );
}
