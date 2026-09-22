"use client";

import { useState, useTransition } from "react";
import { saveHomeHero, saveFeaturedDrop } from "@/actions/admin-content";
import { Panel } from "@/components/admin/Panel";

type HeroData = { eyebrow: string; headline: string; sub: string; subBold: string; badge: string };

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

  function flash(key: string) {
    setSaved(key);
    setTimeout(() => setSaved(null), 2000);
  }

  return (
    <div>
      <Panel title="Homepage hero">
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
