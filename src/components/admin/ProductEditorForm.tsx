"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveProduct, deleteProduct, type ProductFormInput } from "@/actions/admin-products";
import { Panel } from "@/components/admin/Panel";

type VariantRow = {
  id?: string;
  sku: string;
  size: string;
  color: string;
  colorHex: string;
  stockQty: number;
  lowStockThreshold: number;
  priceOverride: number | null;
};

export function ProductEditorForm({
  initial,
  categories,
  collections,
}: {
  initial: (ProductFormInput & { variants: VariantRow[] }) | null;
  categories: { id: string; name: string }[];
  collections: { id: string; title: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [gender, setGender] = useState<"MEN" | "WOMEN" | "UNISEX">(initial?.gender ?? "UNISEX");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? categories[0]?.id ?? "");
  const [basePrice, setBasePrice] = useState(initial?.basePrice ?? 1000);
  const [status, setStatus] = useState<"DRAFT" | "ACTIVE">(initial?.status ?? "DRAFT");
  const [collectionIds, setCollectionIds] = useState<string[]>(initial?.collectionIds ?? []);
  const [tagNew, setTagNew] = useState(initial?.tagNew ?? false);
  const [tagPreorder, setTagPreorder] = useState(initial?.tagPreorder ?? false);
  const [preorderShipDate, setPreorderShipDate] = useState(initial?.preorderShipDate ?? "");
  const [tagLimited, setTagLimited] = useState(initial?.tagLimited ?? false);
  const [tagBestseller, setTagBestseller] = useState(initial?.tagBestseller ?? false);
  const [variants, setVariants] = useState<VariantRow[]>(
    initial?.variants.length
      ? initial.variants
      : [{ sku: "", size: "M", color: "Black", colorHex: "#0c0c0d", stockQty: 0, lowStockThreshold: 5, priceOverride: null }],
  );

  function updateVariant(i: number, patch: Partial<VariantRow>) {
    setVariants((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function addVariant() {
    setVariants((rows) => [
      ...rows,
      { sku: "", size: "M", color: "Black", colorHex: "#0c0c0d", stockQty: 0, lowStockThreshold: 5, priceOverride: null },
    ]);
  }

  function removeVariant(i: number) {
    setVariants((rows) => rows.filter((_, idx) => idx !== i));
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await saveProduct({
        id: initial?.id,
        title,
        slug,
        description,
        gender,
        categoryId,
        basePrice,
        status,
        collectionIds,
        tagNew,
        tagPreorder,
        preorderShipDate,
        tagLimited,
        tagBestseller,
        variants,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push(`/admin/products/${res.id}`);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-4.5 desktop:grid-cols-[1.4fr_1fr]">
      <div>
        <Panel title="Basics">
          <Field label="Title">
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Description">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={inputClass} />
          </Field>
          <div className="border border-dashed border-line-2 p-4 text-center text-[13px] text-muted-2">
            Drag images · placeholder frames render automatically until real photography is uploaded.
          </div>
        </Panel>

        <Panel title="Variants — size × color" className="mt-4.5">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-muted">
                {["SKU", "Size", "Color", "Hex", "Stock", "Low@", "Price ৳", ""].map((h) => (
                  <th key={h} className="font-label pb-1.5">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {variants.map((v, i) => (
                <tr key={i}>
                  <td className="pr-1.5 py-1">
                    <input value={v.sku} onChange={(e) => updateVariant(i, { sku: e.target.value })} className={cellClass} />
                  </td>
                  <td className="pr-1.5 py-1">
                    <input value={v.size} onChange={(e) => updateVariant(i, { size: e.target.value })} className={`${cellClass} w-14`} />
                  </td>
                  <td className="pr-1.5 py-1">
                    <input value={v.color} onChange={(e) => updateVariant(i, { color: e.target.value })} className={cellClass} />
                  </td>
                  <td className="pr-1.5 py-1">
                    <input value={v.colorHex} onChange={(e) => updateVariant(i, { colorHex: e.target.value })} className={`${cellClass} w-20`} />
                  </td>
                  <td className="pr-1.5 py-1">
                    <input
                      type="number"
                      value={v.stockQty}
                      onChange={(e) => updateVariant(i, { stockQty: Number(e.target.value) })}
                      className={`${cellClass} w-16`}
                    />
                  </td>
                  <td className="pr-1.5 py-1">
                    <input
                      type="number"
                      value={v.lowStockThreshold}
                      onChange={(e) => updateVariant(i, { lowStockThreshold: Number(e.target.value) })}
                      className={`${cellClass} w-14`}
                    />
                  </td>
                  <td className="pr-1.5 py-1">
                    <input
                      type="number"
                      value={v.priceOverride ?? ""}
                      placeholder={String(basePrice)}
                      onChange={(e) => updateVariant(i, { priceOverride: e.target.value ? Number(e.target.value) : null })}
                      className={`${cellClass} w-20`}
                    />
                  </td>
                  <td className="py-1">
                    <button onClick={() => removeVariant(i)} className="text-muted hover:text-error">
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={addVariant} className="mt-2.5 border border-line-2 px-3 py-1.5 text-[13px] hover:border-lime">
            + Add variant
          </button>
        </Panel>
      </div>

      <div>
        <Panel title="Organize">
          <Field label="Gender">
            <select value={gender} onChange={(e) => setGender(e.target.value as typeof gender)} className={inputClass}>
              <option value="UNISEX">Unisex</option>
              <option value="MEN">Men</option>
              <option value="WOMEN">Women</option>
            </select>
          </Field>
          <Field label="Category">
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputClass}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Collections">
            <div className="flex flex-wrap gap-3">
              {collections.map((c) => (
                <label key={c.id} className="inline-flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={collectionIds.includes(c.id)}
                    onChange={(e) =>
                      setCollectionIds((ids) => (e.target.checked ? [...ids, c.id] : ids.filter((id) => id !== c.id)))
                    }
                  />
                  {c.title}
                </label>
              ))}
            </div>
          </Field>
          <Field label="Base price ৳">
            <input type="number" value={basePrice} onChange={(e) => setBasePrice(Number(e.target.value))} className={inputClass} />
          </Field>
        </Panel>

        <Panel title="Tags" className="mt-4.5">
          <div className="flex flex-wrap gap-3">
            <Chk checked={tagNew} onChange={setTagNew} label="New" />
            <Chk checked={tagPreorder} onChange={setTagPreorder} label="Preorder" />
            <Chk checked={tagLimited} onChange={setTagLimited} label="Limited" />
            <Chk checked={tagBestseller} onChange={setTagBestseller} label="Bestseller" />
          </div>
          {tagPreorder && (
            <Field label="Preorder ship date" className="mt-2.5">
              <input value={preorderShipDate} onChange={(e) => setPreorderShipDate(e.target.value)} placeholder="15 Oct" className={inputClass} />
            </Field>
          )}
        </Panel>

        <Panel title="Status & SEO" className="mt-4.5">
          <Field label="Status">
            <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={inputClass}>
              <option value="DRAFT">Draft</option>
              <option value="ACTIVE">Active</option>
            </select>
          </Field>
          <Field label="Slug">
            <input value={slug} onChange={(e) => setSlug(e.target.value)} className={inputClass} />
          </Field>
          {error && <p className="mb-2 text-[13px] text-error">{error}</p>}
          <button
            onClick={submit}
            disabled={pending}
            className="btn-primary w-full bg-lime px-4 py-2.5 font-impact text-sm text-ink disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save product"}
          </button>
          {initial?.id && (
            <button
              onClick={() => {
                if (confirm("Delete this product permanently?")) startTransition(() => deleteProduct(initial.id!));
              }}
              className="mt-2 w-full border border-line-2 px-4 py-2 text-sm text-error hover:border-error"
            >
              Delete product
            </button>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Field({ label, className = "", children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`mb-3 ${className}`}>
      <label className="font-label mb-1.5 block text-[13px] tracking-[1.2px] text-muted">{label}</label>
      {children}
    </div>
  );
}

function Chk({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="inline-flex items-center gap-1.5 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /> {label}
    </label>
  );
}

const inputClass = "w-full border border-line-2 bg-ink px-3 py-2 text-sm outline-none focus:border-lime";
const cellClass = "w-full border border-line-2 bg-ink px-1.5 py-1 text-[13px] outline-none focus:border-lime";
