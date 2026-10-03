"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { createCategory, deleteCategory, setCategoryImage, removeCategoryImage } from "@/actions/admin-categories";
import { Panel } from "@/components/admin/Panel";

type Branch = "MEN" | "WOMEN" | "UNISEX";
type Category = { id: string; name: string; slug: string; gender: Branch; imageUrl: string | null; _count: { products: number } };

const BRANCHES: { key: Branch; label: string }[] = [
  { key: "MEN", label: "Men" },
  { key: "WOMEN", label: "Women" },
  { key: "UNISEX", label: "Unisex" },
];

export function CategoryManager({ categories: initialCategories }: { categories: Category[] }) {
  const [branch, setBranch] = useState<Branch>("MEN");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // Tracked locally (not just read from the `categories` prop) so an image upload/remove shows
  // up immediately — revalidatePath() refreshes the Server Component on next navigation, but
  // this client component's own state wouldn't otherwise reflect it until then.
  const [images, setImages] = useState<Record<string, string | null>>(
    () => Object.fromEntries(initialCategories.map((c) => [c.id, c.imageUrl])),
  );
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

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

  async function handleImageFile(categoryId: string, file: File) {
    setImageError(null);
    setUploadingId(categoryId);
    const formData = new FormData();
    formData.append("file", file);
    const res = await setCategoryImage(categoryId, formData);
    setUploadingId(null);
    if (!res.ok) {
      setImageError(res.error);
      return;
    }
    setImages((prev) => ({ ...prev, [categoryId]: res.url }));
  }

  function removeImage(categoryId: string) {
    setImages((prev) => ({ ...prev, [categoryId]: null }));
    startTransition(async () => {
      await removeCategoryImage(categoryId);
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

      <p className="mt-4.5 text-[13px] text-muted">
        Each category&apos;s image is its tile photo everywhere a category shows up as a tile — the homepage&apos;s
        &quot;Shop by category&quot; spotlight and the gender hub&apos;s category grid (<code className="text-muted-2">/men</code>,{" "}
        <code className="text-muted-2">/women</code>). Leave it unset to keep the drawn placeholder.
      </p>
      {imageError && <p className="mt-1.5 text-[13px] text-error">{imageError}</p>}

      <div className="mt-2.5 grid grid-cols-1 gap-4.5 desktop:grid-cols-3">
        {BRANCHES.map((b) => {
          const rows = initialCategories.filter((c) => c.gender === b.key);
          return (
            <Panel key={b.key} title={b.label}>
              {rows.length === 0 ? (
                <p className="text-[13px] text-muted-2">No subcategories yet.</p>
              ) : (
                <ul className="flex flex-col gap-2.5">
                  {rows.map((c) => {
                    const imageUrl = c.id in images ? images[c.id] : c.imageUrl;
                    return (
                      <li key={c.id} className="flex items-center gap-2.5 border-b border-line pb-2.5">
                        {imageUrl ? (
                          <Image src={imageUrl} alt="" width={36} height={36} className="h-9 w-9 shrink-0 border border-line-2 object-cover" />
                        ) : (
                          <div className="grid h-9 w-9 shrink-0 place-items-center border border-dashed border-line-2 text-[9px] text-muted-2">
                            none
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2 text-sm">
                            <span className="truncate">{c.name}</span>
                            <button
                              onClick={() => remove(c.id)}
                              disabled={pending}
                              title={c._count.products > 0 ? "Move its products to another category first" : "Delete"}
                              className="shrink-0 text-muted hover:text-error disabled:opacity-50"
                            >
                              {deletingId === c.id ? "…" : "✕"}
                            </button>
                          </div>
                          <div className="mt-1 flex items-center gap-2.5 text-[12px] text-muted-2">
                            <span>{c._count.products} products</span>
                            <input
                              ref={(el) => {
                                fileInputRefs.current[c.id] = el;
                              }}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                if (e.target.files?.[0]) handleImageFile(c.id, e.target.files[0]);
                                e.target.value = "";
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => fileInputRefs.current[c.id]?.click()}
                              disabled={uploadingId === c.id}
                              className="text-cyan hover:underline disabled:opacity-50"
                            >
                              {uploadingId === c.id ? "Uploading…" : imageUrl ? "Change image" : "Add image"}
                            </button>
                            {imageUrl && (
                              <button type="button" onClick={() => removeImage(c.id)} className="text-error hover:underline">
                                Remove
                              </button>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
