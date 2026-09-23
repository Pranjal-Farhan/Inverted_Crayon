"use client";

import { useState, useTransition } from "react";
import { saveDiscount, deleteDiscount } from "@/actions/admin-discounts";
import { StatusBadge } from "@/components/admin/StatusBadge";

type Discount = {
  id: string;
  code: string;
  type: "PERCENT" | "FIXED" | "FREE_SHIPPING";
  value: number;
  minSpend: number | null;
  firstOrderOnly: boolean;
  usageLimit: number | null;
  usedCount: number;
  active: boolean;
};

const TYPE_LABEL: Record<Discount["type"], string> = { PERCENT: "Percent", FIXED: "Fixed ৳", FREE_SHIPPING: "Free shipping" };

export function DiscountManager({ discounts }: { discounts: Discount[] }) {
  const [editing, setEditing] = useState<Discount | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div>
      <div className="mb-3.5 flex justify-end">
        <button onClick={() => setEditing("new")} className="btn-primary bg-lime px-4 py-2 font-impact text-sm text-ink">
          + New code
        </button>
      </div>
      <div className="border border-line bg-panel p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line-2 text-left text-muted">
              {["Code", "Type", "Value", "Min spend", "Used", "Status", ""].map((h) => (
                <th key={h} className="font-label px-4 py-2.5 text-[13px] tracking-[0.8px]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {discounts.map((d) => (
              <tr key={d.id} className="border-b border-line">
                <td className="px-4 py-2.5">{d.code}</td>
                <td className="px-4 py-2.5">{TYPE_LABEL[d.type]}</td>
                <td className="px-4 py-2.5">{d.type === "PERCENT" ? `${d.value}%` : d.type === "FIXED" ? `৳${d.value}` : "—"}</td>
                <td className="px-4 py-2.5">{d.minSpend ? `Min ৳${d.minSpend}` : "—"}</td>
                <td className="px-4 py-2.5">{d.usedCount}{d.usageLimit ? ` / ${d.usageLimit}` : ""}</td>
                <td className="px-4 py-2.5">
                  <StatusBadge status={d.active ? "Active" : "Draft"} />
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button onClick={() => setEditing(d)} className="text-cyan text-[13px] hover:underline">
                    Edit
                  </button>
                </td>
              </tr>
            ))}
            {discounts.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-muted">
                  No discount codes yet.
                </td>
              </tr>
            )}
          </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <DiscountForm
          discount={editing === "new" ? null : editing}
          pending={pending}
          error={error}
          onCancel={() => {
            setError(null);
            setEditing(null);
          }}
          onSave={(data) =>
            startTransition(async () => {
              setError(null);
              const res = await saveDiscount(data);
              if (!res.ok) {
                setError(res.error);
                return;
              }
              setEditing(null);
            })
          }
          onDelete={
            editing !== "new"
              ? () =>
                  startTransition(async () => {
                    await deleteDiscount(editing.id);
                    setEditing(null);
                  })
              : undefined
          }
        />
      )}
    </div>
  );
}

function DiscountForm({
  discount,
  pending,
  error,
  onCancel,
  onSave,
  onDelete,
}: {
  discount: Discount | null;
  pending: boolean;
  error: string | null;
  onCancel: () => void;
  onSave: (data: {
    id?: string;
    code: string;
    type: Discount["type"];
    value: number;
    minSpend: number | null;
    firstOrderOnly: boolean;
    usageLimit: number | null;
    active: boolean;
  }) => void;
  onDelete?: () => void;
}) {
  const [code, setCode] = useState(discount?.code ?? "");
  const [type, setType] = useState<Discount["type"]>(discount?.type ?? "PERCENT");
  const [value, setValue] = useState(discount?.value ?? 10);
  const [minSpend, setMinSpend] = useState(discount?.minSpend ?? 0);
  const [firstOrderOnly, setFirstOrderOnly] = useState(discount?.firstOrderOnly ?? false);
  const [usageLimit, setUsageLimit] = useState(discount?.usageLimit ?? 0);
  const [active, setActive] = useState(discount?.active ?? true);

  return (
    <div className="mt-3.5 border border-line bg-panel-2 p-4">
      <div className="grid grid-cols-1 gap-2.5 desktop:grid-cols-3">
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="CODE" className="border border-line-2 bg-ink px-2.5 py-1.5 text-sm uppercase" />
        <select value={type} onChange={(e) => setType(e.target.value as Discount["type"])} className="border border-line-2 bg-ink px-2.5 py-1.5 text-sm">
          <option value="PERCENT">Percent</option>
          <option value="FIXED">Fixed ৳</option>
          <option value="FREE_SHIPPING">Free shipping</option>
        </select>
        {type !== "FREE_SHIPPING" && (
          <input type="number" value={value} onChange={(e) => setValue(Number(e.target.value))} placeholder="Value" className="border border-line-2 bg-ink px-2.5 py-1.5 text-sm" />
        )}
      </div>
      <div className="mt-2.5 grid grid-cols-1 gap-2.5 desktop:grid-cols-3">
        <input type="number" value={minSpend} onChange={(e) => setMinSpend(Number(e.target.value))} placeholder="Min spend ৳" className="border border-line-2 bg-ink px-2.5 py-1.5 text-sm" />
        <input type="number" value={usageLimit} onChange={(e) => setUsageLimit(Number(e.target.value))} placeholder="Usage limit (0 = unlimited)" className="border border-line-2 bg-ink px-2.5 py-1.5 text-sm" />
      </div>
      <div className="mt-2.5 flex gap-4">
        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" checked={firstOrderOnly} onChange={(e) => setFirstOrderOnly(e.target.checked)} /> First order only
        </label>
        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active
        </label>
      </div>
      {error && <p className="mt-2.5 text-[13px] text-error">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button
          disabled={pending}
          onClick={() => onSave({ id: discount?.id, code, type, value, minSpend: minSpend || null, firstOrderOnly, usageLimit: usageLimit || null, active })}
          className="btn-primary bg-lime px-3.5 py-1.5 font-impact text-sm text-ink disabled:opacity-50"
        >
          Save
        </button>
        <button onClick={onCancel} className="border border-line-2 px-3.5 py-1.5 text-sm">
          Cancel
        </button>
        {onDelete && (
          <button onClick={onDelete} className="ml-auto text-sm text-error hover:underline">
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
