"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import {
  saveHomeHero,
  saveFeaturedDrop,
  uploadLogoImage,
  uploadHeroImages,
  saveGenderHero,
  uploadGenderHeroImage,
  saveGenderCards,
  uploadGenderCardImage,
  saveMarquee,
} from "@/actions/admin-content";
import type { HeroData } from "@/lib/hero-defaults";
import type { GenderHeroData } from "@/lib/gender-hero-defaults";
import type { GenderCardsData } from "@/lib/gender-cards-defaults";
import { MARQUEE_MIN_LINES, MARQUEE_MAX_LINES, type MarqueeData } from "@/lib/marquee-defaults";
import { Panel } from "@/components/admin/Panel";

export function ContentCmsView({
  hero,
  featuredProductId,
  products,
  menHero,
  womenHero,
  genderCards,
  marquee,
}: {
  hero: HeroData;
  featuredProductId: string | null;
  products: { id: string; title: string }[];
  menHero: GenderHeroData;
  womenHero: GenderHeroData;
  genderCards: GenderCardsData;
  marquee: MarqueeData;
}) {
  const [data, setData] = useState(hero);
  const [productId, setProductId] = useState(featuredProductId ?? "");
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState<string | null>(null);
  const [uploading, setUploading] = useState<"logo" | "hero" | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const heroInputRef = useRef<HTMLInputElement>(null);

  const [menHeroData, setMenHeroData] = useState(menHero);
  const [womenHeroData, setWomenHeroData] = useState(womenHero);
  const [genderHeroUploading, setGenderHeroUploading] = useState<"MEN" | "WOMEN" | null>(null);
  const [genderHeroError, setGenderHeroError] = useState<string | null>(null);
  const menHeroInputRef = useRef<HTMLInputElement>(null);
  const womenHeroInputRef = useRef<HTMLInputElement>(null);

  const [marqueeData, setMarqueeData] = useState(marquee);
  const [marqueeError, setMarqueeError] = useState<string | null>(null);

  function updateMarqueeLine(i: number, value: string) {
    setMarqueeData((m) => ({ lines: m.lines.map((l, idx) => (idx === i ? value : l)) }));
  }
  function addMarqueeLine() {
    setMarqueeData((m) => (m.lines.length >= MARQUEE_MAX_LINES ? m : { lines: [...m.lines, ""] }));
  }
  function removeMarqueeLine(i: number) {
    setMarqueeData((m) => (m.lines.length <= MARQUEE_MIN_LINES ? m : { lines: m.lines.filter((_, idx) => idx !== i) }));
  }
  function handleSaveMarquee() {
    setMarqueeError(null);
    startTransition(async () => {
      const res = await saveMarquee(marqueeData);
      if (!res.ok) {
        setMarqueeError(res.error);
        return;
      }
      flash("marquee");
    });
  }

  const [genderCardsData, setGenderCardsData] = useState(genderCards);
  const [genderCardUploading, setGenderCardUploading] = useState<"male" | "female" | null>(null);
  const [genderCardError, setGenderCardError] = useState<string | null>(null);
  const maleCardInputRef = useRef<HTMLInputElement>(null);
  const femaleCardInputRef = useRef<HTMLInputElement>(null);

  async function handleGenderCardFile(which: "male" | "female", file: File) {
    setGenderCardError(null);
    setGenderCardUploading(which);
    const formData = new FormData();
    formData.append("file", file);
    const res = await uploadGenderCardImage(which, formData);
    setGenderCardUploading(null);
    if (!res.ok) {
      setGenderCardError(res.error);
      return;
    }
    const next = { ...genderCardsData, [which === "male" ? "maleImageUrl" : "femaleImageUrl"]: res.url };
    setGenderCardsData(next);
    await saveGenderCards(next);
    flash(`${which}-card`);
  }

  function removeGenderCardImage(which: "male" | "female") {
    const next = { ...genderCardsData, [which === "male" ? "maleImageUrl" : "femaleImageUrl"]: null };
    setGenderCardsData(next);
    startTransition(async () => {
      await saveGenderCards(next);
    });
  }

  async function handleGenderHeroFile(gender: "MEN" | "WOMEN", file: File) {
    setGenderHeroError(null);
    setGenderHeroUploading(gender);
    const formData = new FormData();
    formData.append("file", file);
    const res = await uploadGenderHeroImage(gender, formData);
    setGenderHeroUploading(null);
    if (!res.ok) {
      setGenderHeroError(res.error);
      return;
    }
    const next = { imageUrl: res.url };
    if (gender === "MEN") setMenHeroData(next);
    else setWomenHeroData(next);
    await saveGenderHero(gender, next);
    flash(`${gender.toLowerCase()}-hero`);
  }

  function removeGenderHeroImage(gender: "MEN" | "WOMEN") {
    const next = { imageUrl: null };
    if (gender === "MEN") setMenHeroData(next);
    else setWomenHeroData(next);
    startTransition(async () => {
      await saveGenderHero(gender, next);
    });
  }

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
              <Image src={data.logoImageUrl} alt="Logo" width={48} height={48} className="h-12 w-12 border border-line-2 object-contain bg-panel-2" />
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
                <Image src={url} alt="" fill sizes="64px" className="object-cover" />
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

      <Panel title="Marquee ticker" className="mt-4.5">
        <p className="mb-3 text-[13px] text-muted">
          The scrolling headline strip under the header, shown on every page. Enter {MARQUEE_MIN_LINES}–
          {MARQUEE_MAX_LINES} headlines, any length.
        </p>
        <div className="flex flex-col gap-2">
          {marqueeData.lines.map((line, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={line}
                onChange={(e) => updateMarqueeLine(i, e.target.value)}
                placeholder={`Headline ${i + 1}`}
                className="w-full border border-line-2 bg-ink px-2.5 py-1.5 text-sm"
              />
              <button
                type="button"
                onClick={() => removeMarqueeLine(i)}
                disabled={marqueeData.lines.length <= MARQUEE_MIN_LINES}
                className="shrink-0 border border-line-2 px-2.5 py-1.5 text-[13px] text-error hover:border-error disabled:opacity-30"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addMarqueeLine}
          disabled={marqueeData.lines.length >= MARQUEE_MAX_LINES}
          className="mt-2.5 border border-line-2 px-3 py-1.5 text-[13px] hover:border-lime disabled:opacity-40"
        >
          + Add headline
        </button>
        {marqueeError && <p className="mt-2 text-[13px] text-error">{marqueeError}</p>}
        <div className="mt-3">
          <button
            disabled={pending}
            onClick={handleSaveMarquee}
            className="btn-primary bg-lime px-4 py-2 font-impact text-sm text-ink disabled:opacity-50"
          >
            {saved === "marquee" ? "Published ✓" : "Publish"}
          </button>
        </div>
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

      <Panel title="Gender hub heroes" className="mt-4.5">
        <p className="mb-3 text-[13px] text-muted">
          The editorial banner at the top of <code className="text-muted-2">/men</code> and{" "}
          <code className="text-muted-2">/women</code>, behind the &quot;Shop Men/Women&quot; button. Leave it unset
          to keep the drawn placeholder.
        </p>
        {genderHeroError && <p className="mb-2 text-[13px] text-error">{genderHeroError}</p>}
        <div className="grid grid-cols-1 gap-4 desktop:grid-cols-2">
          {(
            [
              { gender: "MEN" as const, label: "Men", data: menHeroData, inputRef: menHeroInputRef },
              { gender: "WOMEN" as const, label: "Women", data: womenHeroData, inputRef: womenHeroInputRef },
            ]
          ).map(({ gender, label, data: gd, inputRef }) => (
            <div key={gender}>
              <label className="font-label mb-1 block text-[12px] tracking-[1px] text-muted">{label} hero image</label>
              <div className="mb-2 aspect-[5/1.4] overflow-hidden border border-line-2 bg-panel-2">
                {gd.imageUrl ? (
                  <Image src={gd.imageUrl} alt="" width={400} height={112} className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full place-items-center text-[11px] text-muted-2">default placeholder</div>
                )}
              </div>
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleGenderHeroFile(gender, e.target.files[0]);
                  e.target.value = "";
                }}
              />
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  disabled={genderHeroUploading === gender}
                  className="border border-line-2 px-3 py-1.5 text-[13px] hover:border-lime disabled:opacity-50"
                >
                  {genderHeroUploading === gender ? "Uploading…" : gd.imageUrl ? "Change image" : "Upload image"}
                </button>
                {gd.imageUrl && (
                  <button type="button" onClick={() => removeGenderHeroImage(gender)} className="text-[13px] text-error hover:underline">
                    Remove
                  </button>
                )}
                {saved === `${gender.toLowerCase()}-hero` && <span className="text-[12px] text-lime">Saved ✓</span>}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Shop by category — Male/Female cards" className="mt-4.5">
        <p className="mb-3 text-[13px] text-muted">
          The two cards that open the homepage&apos;s &quot;Shop by category&quot; drill-down. Leave either unset to
          keep the drawn placeholder.
        </p>
        {genderCardError && <p className="mb-2 text-[13px] text-error">{genderCardError}</p>}
        <div className="grid grid-cols-1 gap-4 desktop:grid-cols-2">
          {(
            [
              { which: "male" as const, label: "Male", url: genderCardsData.maleImageUrl, inputRef: maleCardInputRef },
              { which: "female" as const, label: "Female", url: genderCardsData.femaleImageUrl, inputRef: femaleCardInputRef },
            ]
          ).map(({ which, label, url, inputRef }) => (
            <div key={which}>
              <label className="font-label mb-1 block text-[12px] tracking-[1px] text-muted">{label} card image</label>
              <div className="mb-2 aspect-[4/5] overflow-hidden border border-line-2 bg-panel-2">
                {url ? (
                  <Image src={url} alt="" width={300} height={375} className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full place-items-center text-[11px] text-muted-2">default placeholder</div>
                )}
              </div>
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleGenderCardFile(which, e.target.files[0]);
                  e.target.value = "";
                }}
              />
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  disabled={genderCardUploading === which}
                  className="border border-line-2 px-3 py-1.5 text-[13px] hover:border-lime disabled:opacity-50"
                >
                  {genderCardUploading === which ? "Uploading…" : url ? "Change image" : "Upload image"}
                </button>
                {url && (
                  <button type="button" onClick={() => removeGenderCardImage(which)} className="text-[13px] text-error hover:underline">
                    Remove
                  </button>
                )}
                {saved === `${which}-card` && <span className="text-[12px] text-lime">Saved ✓</span>}
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
