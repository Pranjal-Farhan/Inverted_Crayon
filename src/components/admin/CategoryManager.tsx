"use client";

import { useState, useTransition } from "react";
import { createCategory, deleteCategory } from "@/actions/admin-categories";
import { Panel } from "@/components/admin/Panel";

type Branch = "MEN" | "WOMEN" | "UNISEX";
type Category = { id: string; name: string; slug: string; gender: Branch; _count: { products: number } };

const BRANCHES: { key: Branch; label: string }[] = [
  { key: "MEN", label: "Men" },
  { key: "WOMEN", label: "Women" },
  { key: "UNISEX", label: "Unisex" },
];

export function CategoryManager({ categories }: { categories: Category[] }) {
  const [branch, setBranch] = useState<Branch>("MEN");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await createCategory({ gender: branch, name });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setName("");
    });
  }

  function remove(id: string) {
    setError(null);
    setDeletingId(id);
    startTransition(async () => {
      const res = await deleteCategory(id);
      setDeletingId(null);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <div>
      <Panel title="Add a category">
        <p className="mb-3 text-[13px] text-muted">
          Every category belongs to one main branch. A Unisex category is automatically mirrored into Men and Women
          under the same name, so it&apos;s browsable (and selectable on a product) from every relevant branch — the
          products themselves don&apos;t move, they just surface there too.
        </p>
        <div className="flex flex-wrap items-end gap-2.5">
          <div>
            <label className="font-label mb-1.5 block text-[13px] tracking-[1.2px] text-muted">Main category</label>
            <select
              value={branch}
              onChange={(e) => setBranch(e.target.value as Branch)}
              className="border border-line-2 bg-ink px-3 py-2 text-sm outline-none focus:border-lime"
            >
              {BRANCHES.map((b) => (
                <option key={b.key} value={b.key}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="font-label mb-1.5 block text-[13px] tracking-[1.2px] text-muted">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Jeans"
              className="w-full border border-line-2 bg-ink px-3 py-2 text-sm outline-none focus:border-lime"
            />
          </div>
          <button
            onClick={submit}
            disabled={pending || !name.trim()}
            className="btn-primary bg-lime px-4 py-2 font-impact text-sm text-ink disabled:opacity-50"
          >
            + Add
          </button>
        </div>
        {error && <p className="mt-2.5 text-[13px] text-error">{error}</p>}
      </Panel>

      <div className="mt-4.5 grid grid-cols-1 gap-4.5 desktop:grid-cols-3">
        {BRANCHES.map((b) => {
          const rows = categories.filter((c) => c.gender === b.key);
          return (
            <Panel key={b.key} title={b.label}>
              {rows.length === 0 ? (
                <p className="text-[13px] text-muted-2">No subcategories yet.</p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {rows.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-2 border-b border-line py-1.5 text-sm">
                      <span>{c.name}</span>
                      <span className="flex items-center gap-2.5">
                        <span className="text-[12px] text-muted-2">{c._count.products} products</span>
                        <button
                          onClick={() => remove(c.id)}
                          disabled={pending}
                          title={c._count.products > 0 ? "Move its products to another category first" : "Delete"}
                          className="text-muted hover:text-error disabled:opacity-50"
                        >
                          {deletingId === c.id ? "…" : "✕"}
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
