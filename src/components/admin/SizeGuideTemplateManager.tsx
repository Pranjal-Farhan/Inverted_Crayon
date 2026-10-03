"use client";

import { useState, useTransition } from "react";
import { saveSizeGuideTemplate, deleteSizeGuideTemplate } from "@/actions/admin-size-guides";
import { Panel } from "@/components/admin/Panel";
import { SizeGuideTable } from "@/components/admin/SizeGuideTable";
import { DEFAULT_SIZE_GUIDE_COLUMNS, type SizeGuideRow, type SizeGuideTemplateOption } from "@/lib/size-guide";

/** Blank draft used both for "new template" and whenever editing is cancelled. */
function emptyDraft() {
  return { id: null as string | null, name: "", columns: [...DEFAULT_SIZE_GUIDE_COLUMNS], rows: [] as SizeGuideRow[] };
}

export function SizeGuideTemplateManager({ templates }: { templates: SizeGuideTemplateOption[] }) {
  const [draft, setDraft] = useState(emptyDraft);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function editTemplate(t: SizeGuideTemplateOption) {
    setError(null);
    setDraft({ id: t.id, name: t.name, columns: [...t.data.columns], rows: t.data.rows.map((r) => ({ size: r.size, values: [...r.values] })) });
  }

  function updateColumnLabel(i: number, label: string) {
    setDraft((d) => ({ ...d, columns: d.columns.map((c, idx) => (idx === i ? label : c)) }));
  }
  function addColumn() {
    setDraft((d) => ({ ...d, columns: [...d.columns, "Column"], rows: d.rows.map((r) => ({ ...r, values: [...r.values, ""] })) }));
  }
  function removeColumn(i: number) {
    setDraft((d) => ({
      ...d,
      columns: d.columns.filter((_, idx) => idx !== i),
      rows: d.rows.map((r) => ({ ...r, values: r.values.filter((_, idx) => idx !== i) })),
    }));
  }
  function updateRowSize(i: number, size: string) {
    setDraft((d) => ({ ...d, rows: d.rows.map((r, idx) => (idx === i ? { ...r, size } : r)) }));
  }
  function updateRowValue(i: number, colIndex: number, value: string) {
    setDraft((d) => ({
      ...d,
      rows: d.rows.map((r, idx) => (idx === i ? { ...r, values: r.values.map((v, vi) => (vi === colIndex ? value : v)) } : r)),
    }));
  }
  function addRow() {
    setDraft((d) => ({ ...d, rows: [...d.rows, { size: "", values: d.columns.map(() => "") }] }));
  }
  function removeRow(i: number) {
    setDraft((d) => ({ ...d, rows: d.rows.filter((_, idx) => idx !== i) }));
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await saveSizeGuideTemplate({
        id: draft.id ?? undefined,
        name: draft.name,
        data: { columns: draft.columns, rows: draft.rows },
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDraft(emptyDraft());
    });
  }

  function remove(id: string) {
    setError(null);
    setDeletingId(id);
    startTransition(async () => {
      const res = await deleteSizeGuideTemplate(id);
      setDeletingId(null);
      if (!res.ok) setError(res.error);
      else if (draft.id === id) setDraft(emptyDraft());
    });
  }

  return (
    <div>
      <Panel title={draft.id ? `Editing "${draft.name || "untitled"}"` : "New size guide template"}>
        <p className="mb-3 text-[13px] text-muted">
          Build a reusable measurements table once — e.g. &quot;Men&apos;s Tees&quot; or &quot;Snapbacks — One
          Size&quot; — then import it directly into any product&apos;s own Size guide panel from the product editor,
          instead of retyping the same columns and rows every time.
        </p>
        <div className="mb-3 max-w-[320px]">
          <label className="font-label mb-1.5 block text-[13px] tracking-[1.2px] text-muted">Name</label>
          <input
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            placeholder="e.g. Men's Tees"
            className="w-full border border-line-2 bg-ink px-3 py-2 text-sm outline-none focus:border-lime"
          />
        </div>
        <SizeGuideTable
          columns={draft.columns}
          rows={draft.rows}
          onColumnLabelChange={updateColumnLabel}
          onAddColumn={addColumn}
          onRemoveColumn={removeColumn}
          onRowSizeChange={updateRowSize}
          onRowValueChange={updateRowValue}
          onAddRow={addRow}
          onRemoveRow={removeRow}
        />
        {error && <p className="mt-2.5 text-[13px] text-error">{error}</p>}
        <div className="mt-3.5 flex items-center gap-2.5">
          <button
            onClick={submit}
            disabled={pending || !draft.name.trim() || draft.rows.length === 0}
            className="btn-primary bg-lime px-4 py-2 font-impact text-sm text-ink disabled:opacity-50"
          >
            {draft.id ? "Save changes" : "+ Create template"}
          </button>
          {draft.id && (
            <button
              type="button"
              onClick={() => {
                setError(null);
                setDraft(emptyDraft());
              }}
              className="text-[13px] text-muted hover:text-paper"
            >
              Cancel edit
            </button>
          )}
        </div>
      </Panel>

      <Panel title="Saved templates" className="mt-4.5">
        {templates.length === 0 ? (
          <p className="text-[13px] text-muted-2">No templates yet — create one above.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {templates.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2 border-b border-line py-1.5 text-sm">
                <span>
                  {t.name}{" "}
                  <span className="text-[12px] text-muted-2">
                    — {t.data.rows.length} size{t.data.rows.length === 1 ? "" : "s"}
                  </span>
                </span>
                <span className="flex items-center gap-2.5">
                  <button onClick={() => editTemplate(t)} className="text-[12px] text-cyan hover:underline">
                    Edit
                  </button>
                  <button
                    onClick={() => remove(t.id)}
                    disabled={pending}
                    className="text-muted hover:text-error disabled:opacity-50"
                  >
                    {deletingId === t.id ? "…" : "✕"}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
