"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import {
  saveProduct,
  deleteProduct,
  uploadProductImages,
  deleteProductImage,
  type ProductFormInput,
  type ProductImageRow,
} from "@/actions/admin-products";
import { Panel } from "@/components/admin/Panel";

type StagedImage = { file: File; previewUrl: string };

type VariantRow = {
  id?: string;
  sku: string;
  size: string;
  color: string;
  colorHex: string;
  stockQty: number;
  lowStockThreshold: number;
  priceOverride: number | null;
  /** Null = not preorder-eligible once sold out. Set (incl. 0) = it is — see the preorder philosophy note in schema.prisma. */
  preorderAdvanceAmount: number | null;
};

export function ProductEditorForm({
  initial,
  categories,
  collections,
}: {
  initial: (ProductFormInput & { variants: VariantRow[]; images: ProductImageRow[] }) | null;
  categories: { id: string; name: string }[];
  collections: { id: string; title: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<ProductImageRow[]>(initial?.images ?? []);
  const [staged, setStaged] = useState<StagedImage[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [gender, setGender] = useState<"MEN" | "WOMEN" | "UNISEX">(initial?.gender ?? "UNISEX");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? categories[0]?.id ?? "");
  const [basePrice, setBasePrice] = useState(initial?.basePrice ?? 1000);
  const [status, setStatus] = useState<"DRAFT" | "ACTIVE">(initial?.status ?? "DRAFT");
  const [freeDelivery, setFreeDelivery] = useState<"NONE" | "INSIDE_DHAKA" | "NATIONWIDE">(initial?.freeDelivery ?? "NONE");
  const [collectionIds, setCollectionIds] = useState<string[]>(initial?.collectionIds ?? []);
  const [tagNew, setTagNew] = useState(initial?.tagNew ?? false);
  const [tagPreorder, setTagPreorder] = useState(initial?.tagPreorder ?? false);
  const [preorderShipDate, setPreorderShipDate] = useState(initial?.preorderShipDate ?? "");
  const [tagLimited, setTagLimited] = useState(initial?.tagLimited ?? false);
  const [tagBestseller, setTagBestseller] = useState(initial?.tagBestseller ?? false);
  const [variants, setVariants] = useState<VariantRow[]>(
    initial?.variants.length
      ? initial.variants
      : [
          {
            sku: "",
            size: "M",
            color: "Black",
            colorHex: "#0c0c0d",
            stockQty: 0,
            lowStockThreshold: 5,
            priceOverride: null,
            preorderAdvanceAmount: null,
          },
        ],
  );

  function updateVariant(i: number, patch: Partial<VariantRow>) {
    setVariants((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function addVariant() {
    setVariants((rows) => [
      ...rows,
      {
        sku: "",
        size: "M",
        color: "Black",
        colorHex: "#0c0c0d",
        stockQty: 0,
        lowStockThreshold: 5,
        priceOverride: null,
        preorderAdvanceAmount: null,
      },
    ]);
  }

  function removeVariant(i: number) {
    setVariants((rows) => rows.filter((_, idx) => idx !== i));
  }

  async function handleFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
    if (files.length === 0) return;
    setUploadError(null);

    if (initial?.id) {
      setUploading(true);
      const formData = new FormData();
      files.forEach((f) => formData.append("files", f));
      const res = await uploadProductImages(initial.id, formData);
      setUploading(false);
      if (!res.ok) {
        setUploadError(res.error);
        return;
      }
      setImages((prev) => [...prev, ...res.images]);
    } else {
      setStaged((prev) => [...prev, ...files.map((file) => ({ file, previewUrl: URL.createObjectURL(file) }))]);
    }
  }

  async function removeImage(id: string) {
    setImages((prev) => prev.filter((img) => img.id !== id));
    await deleteProductImage(id);
  }

  function removeStaged(index: number) {
    setStaged((prev) => {
      const copy = [...prev];
      const [removed] = copy.splice(index, 1);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return copy;
    });
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
        freeDelivery,
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
      if (staged.length > 0) {
        const formData = new FormData();
        staged.forEach((s) => formData.append("files", s.file));
        await uploadProductImages(res.id, formData);
      }
      router.push(`/admin/products/${res.id}`);
      router.refresh();
    });
  }

  return (
    <div className="grid grid-cols-1 gap-4.5 desktop:grid-cols-[1.4fr_1fr]">
      <div>
        <Panel title="Basics">
          <Field label="Title">
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Description">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={inputClass} />
          </Field>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              handleFiles(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer border border-dashed p-4 text-center text-[13px] transition ${
              dragActive ? "border-lime text-lime" : "border-line-2 text-muted-2"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) handleFiles(e.target.files);
                e.target.value = "";
              }}
            />
            {uploading
              ? "Uploading…"
              : `Drag images here or click to browse · up to 20 per product · placeholder frames render automatically until photos are uploaded.`}
            {uploadError && <div className="mt-1 text-error">{uploadError}</div>}
          </div>
          {(images.length > 0 || staged.length > 0) && (
            <div className="mt-3 grid grid-cols-4 gap-2">
              {images.map((img) => (
                <div key={img.id} className="group relative aspect-square overflow-hidden border border-line">
                  <img src={img.url} alt={img.alt ?? ""} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(img.id)}
                    aria-label="Remove image"
                    className="absolute right-1 top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-ink/80 text-xs text-paper group-hover:flex"
                  >
                    ✕
                  </button>
                </div>
              ))}
              {staged.map((s, i) => (
                <div key={s.previewUrl} className="group relative aspect-square overflow-hidden border border-dashed border-yellow">
                  <img src={s.previewUrl} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeStaged(i)}
                    aria-label="Remove image"
                    className="absolute right-1 top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-ink/80 text-xs text-paper group-hover:flex"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Variants — size × color" className="mt-4.5">
          <p className="mb-2 text-[12px] text-muted-2">
            Stock is set here only for new variants — edit existing stock counts from{" "}
            <a href="/admin/inventory" className="text-cyan hover:underline">
              Inventory
            </a>
            . <strong className="text-paper">Preorder ৳</strong> is the advance charged online once this size sells
            out (blank = just sold out, no preorder offered; 0 = free to reserve, everything due on delivery).
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-muted">
                {["SKU", "Size", "Color", "Hex", "Stock", "Low@", "Price ৳", "Preorder ৳", ""].map((h) => (
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
                      disabled={Boolean(v.id)}
                      title={v.id ? "Edit stock from the Inventory page — this field only sets the starting count for a new variant." : undefined}
                      className={`${cellClass} w-16 ${v.id ? "cursor-not-allowed opacity-50" : ""}`}
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
                  <td className="pr-1.5 py-1">
                    <input
                      type="number"
                      min={0}
                      value={v.preorderAdvanceAmount ?? ""}
                      placeholder="off"
                      title="Advance due online once this size sells out — blank disables preorder for it, 0 means free to reserve."
                      onChange={(e) =>
                        updateVariant(i, { preorderAdvanceAmount: e.target.value ? Number(e.target.value) : null })
                      }
                      className={`${cellClass} w-20 ${v.preorderAdvanceAmount != null ? "border-yellow" : ""}`}
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
          </div>
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
          <Field label="Free delivery">
            <select value={freeDelivery} onChange={(e) => setFreeDelivery(e.target.value as typeof freeDelivery)} className={inputClass}>
              <option value="NONE">None</option>
              <option value="INSIDE_DHAKA">Free delivery — Inside Dhaka</option>
              <option value="NATIONWIDE">Free delivery — Nationwide</option>
            </select>
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
