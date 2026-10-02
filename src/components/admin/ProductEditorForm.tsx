"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";
import {
  saveProduct,
  deleteProduct,
  uploadProductImages,
  deleteProductImage,
  type ProductFormInput,
  type ProductImageRow,
} from "@/actions/admin-products";
import { Panel } from "@/components/admin/Panel";
import { VariantStockStepper } from "@/components/admin/VariantStockStepper";
import { DEFAULT_SIZE_GUIDE_COLUMNS, type SizeGuideRow } from "@/lib/size-guide";
import { slugify } from "@/lib/slugify";

type StagedImage = { file: File; previewUrl: string };
type Branch = "MEN" | "WOMEN" | "UNISEX";
type CategoryOption = { id: string; name: string; slug: string; gender: Branch };

/** Short, deterministic, random-looking token derived from a string — not Math.random(). A
 * variant row's seed needs to be assignable the instant the row is created, including the
 * product form's very first render, which happens once on the server (SSR) and then again
 * during the client's hydration pass; Math.random() would produce a different value each time,
 * so the server-rendered SKU preview text wouldn't match what the client renders and React
 * would flag a hydration mismatch. Hashing a value built from useId() (React's own
 * server/client-stable unique-id primitive) sidesteps that entirely. */
function hashToken(input: string, len: number): string {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (Math.imul(h, 31) + input.charCodeAt(i)) >>> 0;
  return h.toString(36).toUpperCase().padStart(len, "0").slice(-len);
}

/** Title/size/color-derived SKU preview for a not-yet-saved variant. Pure given `seed`, so
 * calling it again on every render as title/size/color change doesn't make the value jump
 * around — only the human-readable parts track the current form state, while `seed` (assigned
 * once, the instant the row is created — see the `nextSkuSeed` calls below) keeps the value
 * stable and unique-looking. The server re-verifies it's actually unique (and appends further
 * randomness only if it collides with some other variant) on save, but this is the real
 * candidate value, not a throwaway placeholder swapped out later. */
function previewSku(title: string, size: string, color: string, seed: string): string {
  const titlePart = slugify(title).replace(/-/g, "").slice(0, 6).toUpperCase() || "SKU";
  const sizePart = size.replace(/[^a-zA-Z0-9]/g, "").slice(0, 4).toUpperCase() || "OS";
  const colorPart = color.replace(/[^a-zA-Z0-9]/g, "").slice(0, 3).toUpperCase() || "COL";
  return `${titlePart}-${sizePart}-${colorPart}-${seed}`;
}

type VariantRow = {
  id?: string;
  /** The real, persisted SKU — only meaningful once `id` is set (an existing variant). For a
   * not-yet-saved row this is ignored in favor of a live previewSku() computed from the current
   * title/size/color, so it stays accurate even if those change before the product is saved. */
  sku: string;
  /** Assigned once, the instant an unsaved row is created — see previewSku(). Unused once the
   * row has a real `id`. */
  skuSeed?: string;
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
}: {
  initial: (ProductFormInput & { variants: VariantRow[]; images: ProductImageRow[] }) | null;
  categories: CategoryOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // A stable, server/client-matching base for generating variant SKU seeds (see hashToken) —
  // useId() itself is guaranteed identical between SSR and hydration; counting up from it per
  // row keeps every seed distinct within this one form instance. The counter lives in a ref, so
  // nextSkuSeed() may only be called from event handlers (addVariant, submit) — never during
  // render, where reading a ref's current value is disallowed (react-hooks/refs). The one seed
  // needed during render itself (the form's pre-seeded default row, below) is derived straight
  // from skuSeedBase with a fixed suffix instead, bypassing the ref entirely.
  const skuSeedBase = useId();
  const skuSeedCounter = useRef(0);
  function nextSkuSeed(): string {
    skuSeedCounter.current += 1;
    return hashToken(`${skuSeedBase}:${skuSeedCounter.current}`, 4);
  }

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<ProductImageRow[]>(initial?.images ?? []);
  const [staged, setStaged] = useState<StagedImage[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  // Auto-derived from the title while the admin hasn't touched it directly — once they do
  // (or when editing an already-saved product, where the slug is its live URL), title edits
  // stop silently rewriting it, so renaming a product never breaks an already-shared link.
  const [slugTouched, setSlugTouched] = useState(Boolean(initial));
  function handleTitleChange(next: string) {
    setTitle(next);
    if (!slugTouched) setSlug(slugify(next));
  }
  function handleSlugChange(next: string) {
    setSlug(next);
    setSlugTouched(true);
  }
  const [description, setDescription] = useState(initial?.description ?? "");
  const initialCategory = initial ? categories.find((c) => c.id === initial.categoryId) : undefined;
  const [branch, setBranch] = useState<Branch>(initialCategory?.gender ?? "UNISEX");
  const [categoryId, setCategoryId] = useState(
    initial?.categoryId ?? categories.find((c) => c.gender === "UNISEX")?.id ?? "",
  );
  const [basePrice, setBasePrice] = useState(initial?.basePrice ?? 1000);
  const [status, setStatus] = useState<"DRAFT" | "ACTIVE">(initial?.status ?? "DRAFT");
  const [freeDelivery, setFreeDelivery] = useState<"NONE" | "INSIDE_DHAKA" | "NATIONWIDE">(initial?.freeDelivery ?? "NONE");
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
          skuSeed: hashToken(`${skuSeedBase}:0`, 4),
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
        skuSeed: nextSkuSeed(),
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

  const [sgColumns, setSgColumns] = useState<string[]>(initial?.sizeGuide?.columns ?? DEFAULT_SIZE_GUIDE_COLUMNS);
  const [sgRows, setSgRows] = useState<SizeGuideRow[]>(initial?.sizeGuide?.rows ?? []);

  function updateColumnLabel(i: number, label: string) {
    setSgColumns((cols) => cols.map((c, idx) => (idx === i ? label : c)));
  }
  function addColumn() {
    setSgColumns((cols) => [...cols, "Column"]);
    setSgRows((rows) => rows.map((r) => ({ ...r, values: [...r.values, ""] })));
  }
  function removeColumn(i: number) {
    setSgColumns((cols) => cols.filter((_, idx) => idx !== i));
    setSgRows((rows) => rows.map((r) => ({ ...r, values: r.values.filter((_, idx) => idx !== i) })));
  }
  function updateRowSize(i: number, size: string) {
    setSgRows((rows) => rows.map((r, idx) => (idx === i ? { ...r, size } : r)));
  }
  function updateRowValue(i: number, colIndex: number, value: string) {
    setSgRows((rows) =>
      rows.map((r, idx) => (idx === i ? { ...r, values: r.values.map((v, vi) => (vi === colIndex ? value : v)) } : r)),
    );
  }
  function addSizeRow() {
    setSgRows((rows) => [...rows, { size: "", values: sgColumns.map(() => "") }]);
  }
  function removeSizeRow(i: number) {
    setSgRows((rows) => rows.filter((_, idx) => idx !== i));
  }
  function prefillSizesFromVariants() {
    const distinctSizes = [...new Set(variants.map((v) => v.size.trim()).filter(Boolean))];
    setSgRows((rows) => distinctSizes.map((size) => rows.find((r) => r.size === size) ?? { size, values: sgColumns.map(() => "") }));
  }

  const subcategories = categories.filter((c) => c.gender === branch);

  function handleBranchChange(next: Branch) {
    setBranch(next);
    const stillValid = categories.find((c) => c.id === categoryId)?.gender === next;
    if (!stillValid) setCategoryId(categories.find((c) => c.gender === next)?.id ?? "");
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

    // Each size+color pair must be unique per product (Variant's own DB constraint) — "+ Add
    // variant" defaults every new row to the same M/Black, so adding two in a row without
    // changing one is an easy, common mistake. Catching it here means a specific, actionable
    // message instead of a round trip ending in a generic "something went wrong".
    const seenSizeColor = new Set<string>();
    for (const v of variants) {
      const key = `${v.size.trim().toLowerCase()}\u0000${v.color.trim().toLowerCase()}`;
      if (seenSizeColor.has(key)) {
        setError(`Two variant rows both have size "${v.size}" / color "${v.color}" — each size+color combination can only appear once. Change one of them.`);
        return;
      }
      seenSizeColor.add(key);
    }

    startTransition(async () => {
      // A server action that throws instead of returning {ok:false} used to escape this
      // transition entirely — the button's "Saving…" state would still clear (the transition
      // settles on rejection too), but nothing here ever ran to explain why, so it just looked
      // like the Save button silently did nothing. Every real failure path in saveProduct now
      // returns {ok:false, error} instead of throwing, but this stays as the last line of
      // defense for anything truly unexpected (a network drop mid-request, etc.) so the admin
      // always gets a message instead of a mysterious no-op.
      try {
        // Freeze each unsaved row's live SKU preview into a real value at the moment of
        // submission — matches exactly what was last on screen, computed from the same
        // title/size/color the admin was looking at.
        const variantsPayload = variants.map((v) =>
          v.id ? v : { ...v, sku: previewSku(title, v.size, v.color, v.skuSeed ?? nextSkuSeed()) },
        );
        const res = await saveProduct({
          id: initial?.id,
          title,
          slug,
          description,
          categoryId,
          basePrice,
          status,
          freeDelivery,
          tagNew,
          tagPreorder,
          preorderShipDate,
          tagLimited,
          tagBestseller,
          variants: variantsPayload,
          sizeGuide: sgRows.length > 0 ? { columns: sgColumns, rows: sgRows } : null,
        });
        if (!res.ok) {
          setError(res.error);
          return;
        }
        if (staged.length > 0) {
          const formData = new FormData();
          staged.forEach((s) => formData.append("files", s.file));
          const uploadRes = await uploadProductImages(res.id, formData);
          if (!uploadRes.ok) {
            // The product itself did save — route there anyway (below) so a retry edits the
            // real product instead of creating a duplicate; this just flags the image upload
            // specifically needs retrying from that page.
            setError(`Product saved, but image upload failed: ${uploadRes.error}`);
          }
        }
        router.push(`/admin/products/${res.id}`);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong saving this product. Please try again.");
      }
    });
  }

  return (
    <div className="grid grid-cols-1 gap-4.5 desktop:grid-cols-[1.4fr_1fr]">
      <div>
        <Panel title="Basics">
          <Field label="Title">
            <input value={title} onChange={(e) => handleTitleChange(e.target.value)} className={inputClass} />
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
            className={`cursor-pointer border border-dashed p-4 text-center text-[13px] transition ${dragActive ? "border-lime text-lime" : "border-line-2 text-muted-2"
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
                  <Image src={img.url} alt={img.alt ?? ""} fill sizes="25vw" className="object-cover" />
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
                  <Image src={s.previewUrl} alt="" fill unoptimized sizes="25vw" className="object-cover" />
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
            Stock for an existing variant updates live with the +/− stepper (or edit the number directly) — it saves
            immediately, independent of the Save product button below. The same count can also be managed in bulk from{" "}
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
                    <td className="pr-1.5 py-1 text-muted" title="Auto-generated — not editable.">
                      {v.id ? v.sku : previewSku(title, v.size, v.color, v.skuSeed ?? "")}
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
                      {v.id ? (
                        <VariantStockStepper variantId={v.id} initialStock={v.stockQty} />
                      ) : (
                        <input
                          type="number"
                          value={v.stockQty}
                          onChange={(e) => updateVariant(i, { stockQty: Number(e.target.value) })}
                          title="Starting stock count — saved when this new variant is saved with the product."
                          className={`${cellClass} w-16`}
                        />
                      )}
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

        <Panel title="Size guide" className="mt-4.5">
          <p className="mb-2 text-[12px] text-muted-2">
            Measurements shown on this product&apos;s PDP under &quot;Size guide →&quot;. Leave every row empty to
            fall back to the generic reference chart instead.
          </p>
          <button
            type="button"
            onClick={prefillSizesFromVariants}
            className="mb-2.5 border border-line-2 px-2.5 py-1.5 text-[12px] hover:border-lime"
          >
            Use sizes from variants
          </button>
          {sgRows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left text-muted">
                    <th className="font-label pb-1.5">Size</th>
                    {sgColumns.map((col, i) => (
                      <th key={i} className="font-label pb-1.5">
                        <div className="flex items-center gap-1">
                          <input
                            value={col}
                            onChange={(e) => updateColumnLabel(i, e.target.value)}
                            aria-label={`Column ${i + 1} label`}
                            className={`${cellClass} w-20`}
                          />
                          {sgColumns.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeColumn(i)}
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
                      {sgColumns.length < 6 && (
                        <button type="button" onClick={addColumn} className="text-cyan hover:underline">
                          + col
                        </button>
                      )}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sgRows.map((row, i) => (
                    <tr key={i}>
                      <td className="pr-1.5 py-1">
                        <input
                          value={row.size}
                          onChange={(e) => updateRowSize(i, e.target.value)}
                          aria-label="Size"
                          className={`${cellClass} w-14`}
                        />
                      </td>
                      {sgColumns.map((col, ci) => (
                        <td key={ci} className="pr-1.5 py-1">
                          <input
                            value={row.values[ci] ?? ""}
                            onChange={(e) => updateRowValue(i, ci, e.target.value)}
                            aria-label={col || `Column ${ci + 1}`}
                            className={`${cellClass} w-16`}
                          />
                        </td>
                      ))}
                      <td className="py-1">
                        <button type="button" onClick={() => removeSizeRow(i)} className="text-muted hover:text-error">
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <button type="button" onClick={addSizeRow} className="mt-2.5 border border-line-2 px-3 py-1.5 text-[13px] hover:border-lime">
            + Add size row
          </button>
        </Panel>
      </div>

      <div>
        <Panel title="Organize">
          <Field label="Main category">
            <select value={branch} onChange={(e) => handleBranchChange(e.target.value as Branch)} className={inputClass}>
              <option value="UNISEX">Unisex</option>
              <option value="MEN">Men</option>
              <option value="WOMEN">Women</option>
            </select>
          </Field>
          <Field label="Sub category">
            {subcategories.length > 0 ? (
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputClass}>
                {subcategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-[13px] text-muted-2">
                No subcategories under this branch yet — add one from{" "}
                <a href="/admin/categories" className="text-cyan hover:underline">
                  Categories
                </a>
                .
              </p>
            )}
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
            <input value={slug} onChange={(e) => handleSlugChange(e.target.value)} className={inputClass} />
            <p className="mt-1 text-[12px] text-muted-2">
              {slugTouched ? "This product's URL — /product/" + (slug || "…") + "." : "Auto-filled from the title — edit to override."}
            </p>
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
