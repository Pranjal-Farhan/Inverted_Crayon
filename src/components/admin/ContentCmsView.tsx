"use client";

import { useRef, useState, useTransition } from "react";
import { saveHomeHero, saveFeaturedDrop, uploadLogoImage, uploadHeroImages } from "@/actions/admin-content";
import type { HeroData } from "@/lib/hero-defaults";
import { Panel } from "@/components/admin/Panel";

export function ContentCmsView({
  hero,
  featuredProductId,
  products,
}: {
  hero: HeroData;
  featuredProductId: string | null;
  products: { id: string; title: string }[];
}) {
  const [data, setData] = useState(hero);
  const [productId, setProductId] = useState(featuredProductId ?? "");
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState<string | null>(null);
  const [uploading, setUploading] = useState<"logo" | "hero" | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const heroInputRef = useRef<HTMLInputElement>(null);

  function flash(key: string) {
    setSaved(key);
    setTimeout(() => setSaved(null), 2000);
  }

  async function persist(next: HeroData) {
    setData(next);
    await saveHomeHero(next);
  }

  async function handleLogoFile(file: File) {
    setUploadError(null);
    setUploading("logo");
    const formData = new FormData();
    formData.append("file", file);
    const res = await uploadLogoImage(formData);
    setUploading(null);
    if (!res.ok) {
      setUploadError(res.error);
      return;
    }
    await persist({ ...data, logoImageUrl: res.url });
  }

  async function handleHeroFiles(fileList: FileList) {
    setUploadError(null);
    setUploading("hero");
    const formData = new FormData();
    Array.from(fileList).forEach((f) => formData.append("files", f));
    const res = await uploadHeroImages(formData);
    setUploading(null);
    if (!res.ok) {
      setUploadError(res.error);
      return;
    }
    await persist({ ...data, heroImages: [...data.heroImages, ...res.urls] });
  }

  function removeHeroImage(url: string) {
    startTransition(async () => {
      await persist({ ...data, heroImages: data.heroImages.filter((u) => u !== url) });
    });
  }

  return (
    <div>
      <Panel title="Brand identity">
        <p className="mb-3 text-[13px] text-muted">
          The logo and brand name show up in the header, footer, and print receipts. Leave the logo empty to keep the
          default drawn monogram.
        </p>
        <div className="mb-3.5">
          <label className="font-label mb-1 block text-[12px] tracking-[1px] text-muted">Logo image</label>
          <div className="flex items-center gap-3">
            {data.logoImageUrl ? (
              <img src={data.logoImageUrl} alt="Logo" className="h-12 w-12 border border-line-2 object-contain bg-panel-2" />
            ) : (
              <div className="grid h-12 w-12 place-items-center border border-dashed border-line-2 text-[10px] text-muted-2">
                default
              </div>
            )}
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) handleLogoFile(e.target.files[0]);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => logoInputRef.current?.click()}
              disabled={uploading === "logo"}
              className="border border-line-2 px-3 py-1.5 text-[13px] hover:border-lime disabled:opacity-50"
            >
              {uploading === "logo" ? "Uploading…" : "Upload logo"}
            </button>
            {data.logoImageUrl && (
              <button
                type="button"
                onClick={() => persist({ ...data, logoImageUrl: null })}
                className="text-[13px] text-error hover:underline"
              >
                Remove
              </button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2.5 desktop:grid-cols-2">
          <div>
            <label className="font-label mb-1 block text-[12px] tracking-[1px] text-muted">Brand name</label>
            <input
              value={data.brandName}
              onChange={(e) => setData((d) => ({ ...d, brandName: e.target.value }))}
              className="w-full border border-line-2 bg-ink px-2.5 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="font-label mb-1 block text-[12px] tracking-[1px] text-muted">Motto</label>
            <input
              value={data.motto}
              onChange={(e) => setData((d) => ({ ...d, motto: e.target.value }))}
              className="w-full border border-line-2 bg-ink px-2.5 py-1.5 text-sm"
            />
          </div>
        </div>
      </Panel>

      <Panel title="Homepage hero" className="mt-4.5">
        <p className="mb-3 text-[13px] text-muted">Edit the storefront hero without code deploys.</p>
        {(["eyebrow", "headline", "sub", "subBold", "badge"] as const).map((key) => (
          <div key={key} className="mb-2.5">
            <label className="font-label mb-1 block text-[12px] tracking-[1px] text-muted">{key}</label>
            <input
              value={data[key]}
              onChange={(e) => setData((d) => ({ ...d, [key]: e.target.value }))}
              className="w-full border border-line-2 bg-ink px-2.5 py-1.5 text-sm"
            />
          </div>
        ))}
        <div className="mb-2.5">
          <label className="font-label mb-1 block text-[12px] tracking-[1px] text-muted">Hero background color</label>
          <div className="flex items-center gap-2.5">
            <input
              type="color"
              value={data.backgroundColor ?? "#0c0c0d"}
              onChange={(e) => setData((d) => ({ ...d, backgroundColor: e.target.value }))}
              className="h-9 w-14 border border-line-2 bg-ink"
            />
            {data.backgroundColor && (
              <button
                type="button"
                onClick={() => setData((d) => ({ ...d, backgroundColor: null }))}
                className="text-[13px] text-cyan hover:underline"
              >
                Use default
              </button>
            )}
          </div>
        </div>

        <div className="mb-3">
          <label className="font-label mb-1 block text-[12px] tracking-[1px] text-muted">Hero carousel images</label>
          <div className="mb-2 flex flex-wrap gap-2">
            {data.heroImages.map((url) => (
              <div key={url} className="group relative h-16 w-16 overflow-hidden border border-line">
                <img src={url} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeHeroImage(url)}
                  aria-label="Remove image"
                  className="absolute right-0.5 top-0.5 hidden h-5 w-5 items-center justify-center rounded-full bg-ink/80 text-xs text-paper group-hover:flex"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <input
            ref={heroInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) handleHeroFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => heroInputRef.current?.click()}
            disabled={uploading === "hero"}
            className="border border-line-2 px-3 py-1.5 text-[13px] hover:border-lime disabled:opacity-50"
          >
            {uploading === "hero" ? "Uploading…" : "+ Add hero image"}
          </button>
          <p className="mt-1 text-[11px] text-muted-2">
            No images uploaded yet? The hero shows a styled placeholder instead. Add one or more to run a real photo
            carousel.
          </p>
        </div>

        {uploadError && <p className="mb-2 text-[13px] text-error">{uploadError}</p>}

        <button
          disabled={pending}
          onClick={() => startTransition(async () => { await saveHomeHero(data); flash("hero"); })}
          className="btn-primary mt-1 bg-lime px-4 py-2 font-impact text-sm text-ink disabled:opacity-50"
        >
          {saved === "hero" ? "Published ✓" : "Publish"}
        </button>
      </Panel>

      <Panel title="Featured drop" className="mt-4.5">
        <label className="font-label mb-1.5 block text-[13px] tracking-[1.2px] text-muted">Featured product</label>
        <select value={productId} onChange={(e) => setProductId(e.target.value)} className="w-full border border-line-2 bg-ink px-2.5 py-1.5 text-sm">
          <option value="">None</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
        <button
          disabled={pending}
          onClick={() => startTransition(async () => { await saveFeaturedDrop(productId || null); flash("drop"); })}
          className="btn-primary mt-3 bg-lime px-4 py-2 font-impact text-sm text-ink disabled:opacity-50"
        >
          {saved === "drop" ? "Published ✓" : "Publish"}
        </button>
      </Panel>

      <Panel title="Blocks" className="mt-4.5">
        <p className="text-sm text-muted">
          Collection tiles are managed from <a href="/admin/categories" className="text-cyan">Categories &amp; collections</a>.
          Gender-hub heroes and lookbook editing ship in a fast-follow.
        </p>
      </Panel>
    </div>
  );
}
