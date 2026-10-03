"use client";

import type { SizeGuideRow } from "@/lib/size-guide";

const cellClass = "w-full border border-line-2 bg-ink px-1.5 py-1 text-[13px] outline-none focus:border-lime";

/** The columns/rows measurement grid shared by a product's own Size guide panel
 * (ProductEditorForm.tsx) and the reusable template editor (SizeGuideTemplateManager.tsx) —
 * same table, different state owner. */
export function SizeGuideTable({
  columns,
  rows,
  onColumnLabelChange,
  onAddColumn,
  onRemoveColumn,
  onRowSizeChange,
  onRowValueChange,
  onAddRow,
  onRemoveRow,
}: {
  columns: string[];
  rows: SizeGuideRow[];
  onColumnLabelChange: (i: number, label: string) => void;
  onAddColumn: () => void;
  onRemoveColumn: (i: number) => void;
  onRowSizeChange: (i: number, size: string) => void;
  onRowValueChange: (i: number, colIndex: number, value: string) => void;
  onAddRow: () => void;
  onRemoveRow: (i: number) => void;
}) {
  return (
    <div>
      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-muted">
                <th className="font-label pb-1.5">Size</th>
                {columns.map((col, i) => (
                  <th key={i} className="font-label pb-1.5">
                    <div className="flex items-center gap-1">
                      <input
                        value={col}
                        onChange={(e) => onColumnLabelChange(i, e.target.value)}
                        aria-label={`Column ${i + 1} label`}
                        className={`${cellClass} w-20`}
                      />
                      {columns.length > 1 && (
                        <button
                          type="button"
                          onClick={() => onRemoveColumn(i)}
                          aria-label={`Remove ${col || "column"}`}
                          className="text-muted hover:text-error"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </th>
                ))}
                <th className="font-label pb-1.5">
                  {columns.length < 6 && (
                    <button type="button" onClick={onAddColumn} className="text-cyan hover:underline">
                      + col
                    </button>
                  )}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  <td className="pr-1.5 py-1">
                    <input
                      value={row.size}
                      onChange={(e) => onRowSizeChange(i, e.target.value)}
                      aria-label="Size"
                      className={`${cellClass} w-14`}
                    />
                  </td>
                  {columns.map((col, ci) => (
                    <td key={ci} className="pr-1.5 py-1">
                      <input
                        value={row.values[ci] ?? ""}
                        onChange={(e) => onRowValueChange(i, ci, e.target.value)}
                        aria-label={col || `Column ${ci + 1}`}
                        className={`${cellClass} w-16`}
                      />
                    </td>
                  ))}
                  <td className="py-1">
                    <button type="button" onClick={() => onRemoveRow(i)} className="text-muted hover:text-error">
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <button type="button" onClick={onAddRow} className="mt-2.5 border border-line-2 px-3 py-1.5 text-[13px] hover:border-lime">
        + Add size row
      </button>
    </div>
  );
}
