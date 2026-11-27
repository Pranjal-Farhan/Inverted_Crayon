"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { importProduct, previewProductImport, type ImportPreviewItem } from "@/actions/admin-product-import";
import { Panel } from "@/components/admin/Panel";
import { IMPORT_EXAMPLE } from "@/lib/product-import-example";
import { formatTaka } from "@/lib/money";

type Phase = "edit" | "previewing" | "preview" | "importing" | "done";
type Outcome = { state: "waiting" | "creating" | "created" | "failed"; id?: string; message?: string };

const MAX_FILE_BYTES = 1_000_000;
const GENDER_LABEL = { MEN: "Men", WOMEN: "Women", UNISEX: "Unisex" } as const;

const primaryButton = "btn-primary bg-lime px-4 py-2 font-impact text-sm text-ink disabled:opacity-50";
const secondaryButton = "border border-line-2 px-3 py-2 text-sm hover:border-lime disabled:opacity-50";

function preorderLabel(v: number | null | "mixed"): string {
  if (v === "mixed") return "varies by colour";
  if (v === null) return "off — shows as sold out at stock 0";
  return v === 0 ? "on, ৳0 up front (everything on delivery)" : `on, ${formatTaka(v)} up front`;
}

/** Paste JSON → preview what would happen → create the products as Drafts, one at a time. */
export function ProductImportForm() {
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<Phase>("edit");
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ImportPreviewItem[]>([]);
  const [outcomes, setOutcomes] = useState<Record<number, Outcome>>({});
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const busy = phase === "previewing" || phase === "importing";
  const ready = items.filter((i) => i.state === "ready");
  const created = Object.values(outcomes).filter((o) => o.state === "created").length;

  function edit(next: string) {
    setText(next);
    setPhase("edit");
    setItems([]);
    setOutcomes({});
    setError(null);
  }

  async function loadFile(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setError("That file is too big for one import (1 MB at most).");
      return;
    }
    edit(await file.text());
  }

  async function preview() {
    setPhase("previewing");
    setError(null);
    setOutcomes({});
    try {
      const res = await previewProductImport(text);
      if (!res.ok) {
        setError(res.error);
        setItems([]);
        setPhase("edit");
        return;
      }
      setItems(res.items);
      setPhase("preview");
    } catch {
      setError("The preview didn't go through — check your connection and try again.");
      setPhase("edit");
    }
  }

  async function create() {
    setPhase("importing");
    setError(null);
    setOutcomes(Object.fromEntries(ready.map((i) => [i.index, { state: "waiting" } as Outcome])));
    for (const item of ready) {
      setOutcomes((o) => ({ ...o, [item.index]: { state: "creating" } }));
      let outcome: Outcome;
      try {
        const res = await importProduct(text, item.index);
        outcome = res.ok ? { state: "created", id: res.id, message: res.note } : { state: "failed", message: res.error };
      } catch {
        // The request may or may not have reached the server — previewing again shows what exists.
        outcome = { state: "failed", message: "The request didn't come back. Preview again to see whether it was created." };
      }
      setOutcomes((o) => ({ ...o, [item.index]: outcome }));
    }
    setPhase("done");
  }

  async function copyExample() {
    try {
      await navigator.clipboard.writeText(IMPORT_EXAMPLE);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the example is on screen to select by hand */
    }
  }

  return (
    <div className="mx-auto max-w-[900px] space-y-4">
      <Panel title="Paste product JSON">
        <p className="mb-3 text-sm text-muted">
          Paste the JSON for one product or several (up to 30). You&apos;ll see a preview first — <strong className="text-paper">nothing is created until you press Create</strong>. Every product is
          created as a <strong className="text-paper">Draft</strong>: add its photos in the editor, then set Status to Active.
        </p>
        <textarea
          value={text}
          onChange={(e) => edit(e.target.value)}
          disabled={busy}
          spellCheck={false}
          aria-label="Product JSON"
          placeholder={'{ "products": [ { "title": "…", "gender": "WOMEN", "category": "Outerwear", … } ] }'}
          className="min-h-[320px] w-full border border-line-2 bg-ink p-3 font-mono text-[13px] leading-relaxed outline-none focus:border-lime disabled:opacity-60"
        />
        <div className="mt-3 flex flex-wrap items-center gap-2.5">
          <button type="button" onClick={preview} disabled={busy || !text.trim()} className={primaryButton}>
            {phase === "previewing" ? "Checking…" : "Preview"}
          </button>
          <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className={secondaryButton}>
            Load a .json file
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json,text/plain"
            className="hidden"
            onChange={(e) => {
              void loadFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          {text && (
            <button type="button" onClick={() => edit("")} disabled={busy} className="text-[13px] text-muted hover:text-error disabled:opacity-50">
              Clear
            </button>
          )}
        </div>
        {error && (
          <p role="alert" className="mt-3 border border-error/40 bg-error/[0.08] px-3 py-2 text-[13px] text-error">
            {error}
          </p>
        )}
      </Panel>

      {items.length > 0 && (
        <Panel title="Preview">
          <p className="mb-3 text-sm" aria-live="polite">
            {ready.length} ready · {items.filter((i) => i.state === "exists").length} already in your store · {items.filter((i) => i.state === "error").length} need fixing
          </p>
          <ul className="space-y-3">
            {items.map((item) => (
              <ItemCard key={item.index} item={item} outcome={outcomes[item.index]} />
            ))}
          </ul>

          {phase === "preview" && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button type="button" onClick={create} disabled={ready.length === 0} className={primaryButton}>
                {ready.length === 1 ? "Create 1 draft" : `Create ${ready.length} drafts`}
              </button>
              {ready.length === 0 && <span className="text-[13px] text-muted">Nothing here can be created yet — fix the items above and preview again.</span>}
              {ready.length > 0 && items.length > ready.length && <span className="text-[13px] text-muted">Items that need fixing or already exist are skipped.</span>}
            </div>
          )}
          {phase === "importing" && <p className="mt-4 text-sm text-muted">Creating… keep this page open.</p>}
          {phase === "done" && (
            <div className="mt-4 border border-line-2 p-3.5 text-sm" aria-live="polite">
              <p className="font-label tracking-[0.8px]">
                {created} of {ready.length} created as {created === 1 ? "a draft" : "drafts"}.
              </p>
              {created > 0 && <p className="mt-1 text-muted">Next: open each draft, add its photos, then set Status to Active and Save.</p>}
              {created < ready.length && <p className="mt-1 text-error">Some failed — see the messages above. Fix the JSON and preview again; anything already created is skipped.</p>}
              <div className="mt-3 flex gap-2.5">
                <Link href="/admin/products" className={secondaryButton}>
                  Go to Products
                </Link>
                <button type="button" onClick={() => edit("")} className={secondaryButton}>
                  Import more
                </button>
              </div>
            </div>
          )}
        </Panel>
      )}

      <Panel title="JSON format">
        <details>
          <summary className="cursor-pointer text-sm hover:text-lime">Show the format and an example</summary>
          <div className="mt-3 space-y-3 text-[13px] text-muted">
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <code>gender</code> is MEN, WOMEN or UNISEX, and <code>category</code> is the category&apos;s name under it (e.g. Outerwear).
                A UNISEX product can also be listed under a Men and a Women category: add <code>{'"menCategory": "Tees"'}</code> and/or{" "}
                <code>{'"womenCategory": "Tops"'}</code>.
              </li>
              <li>
                <code>price</code>, and optionally <code>salePrice</code> (what it sells for) — or <code>{'"discount": { "type": "PERCENT", "value": 20 }'}</code>.
              </li>
              <li>
                <code>build</code> and <code>howToWear</code> can be lists; we turn them into the bullets and paragraphs the product page shows. <code>mood</code> is plain text.
              </li>
              <li>
                <code>colors</code>: each has a <code>name</code>, a <code>hex</code> (#RRGGBB) and optionally a <code>code</code> for its SKUs, plus its own <code>stock</code> (one number, or per size
                like {'{ "S": 2, "M": 5 }'}), <code>price</code> or <code>preorderAdvance</code>.
              </li>
              <li>
                Every colour gets all six sizes (S–XXXL), or just One Size with <code>{'"sizing": "ONE_SIZE"'}</code>. <code>stock</code> and <code>preorderAdvance</code> at the top level apply to every
                variant (0 = preorder with everything paid on delivery; leave out for no preorder).
              </li>
              <li>
                <code>skuPattern</code> such as <code>SCRIB-{'{COLOR}'}-{'{SIZE}'}</code>. Without one, SKUs start with the first six letters of the title.
              </li>
              <li>
                Optional: <code>slug</code>, <code>tags</code> (NEW, PREORDER, LIMITED, BESTSELLER), <code>seoTitle</code>, <code>seoDescription</code>, <code>freeDelivery</code>,{" "}
                <code>deliveryChargeInsideDhaka</code>/<code>deliveryChargeOutsideDhaka</code>, <code>sizeGuide</code>, <code>lowStockThreshold</code>, and <code>purchaseCost</code> (admins only).
              </li>
              <li>A misspelt field name is reported rather than ignored, and a product whose web address already exists is skipped, so importing the same file twice is safe.</li>
            </ul>
            <div className="flex items-center justify-between">
              <span className="font-label tracking-[0.8px] text-paper">Example</span>
              <button type="button" onClick={copyExample} className="text-[13px] hover:text-lime">
                {copied ? "Copied ✓" : "Copy example"}
              </button>
            </div>
            <pre className="max-h-[360px] overflow-auto border border-line-2 bg-ink p-3 font-mono text-[12px] leading-relaxed text-paper">{IMPORT_EXAMPLE}</pre>
          </div>
        </details>
      </Panel>
    </div>
  );
}

function ItemCard({ item, outcome }: { item: ImportPreviewItem; outcome?: Outcome }) {
  const pill =
    item.state === "ready"
      ? { label: "Ready", cls: "bg-lime text-ink" }
      : item.state === "exists"
        ? { label: "Already exists — skipped", cls: "bg-yellow text-ink" }
        : { label: "Needs fixing", cls: "bg-error text-ink" };
  const s = item.summary;

  return (
    <li className="border border-line-2 p-3.5">
      <div className="flex flex-wrap items-center gap-2.5">
        <h4 className="font-impact text-base uppercase">{item.title}</h4>
        {item.slug && <span className="font-mono text-[12px] text-muted">/{item.slug}</span>}
        <span className={`ml-auto px-2 py-0.5 font-label text-[11px] tracking-[0.8px] ${pill.cls}`}>{pill.label}</span>
      </div>

      {s && (
        <dl className="mt-2.5 grid grid-cols-1 gap-x-6 gap-y-1 text-[13px] sm:grid-cols-2">
          <Row label="Category" value={`${GENDER_LABEL[s.gender]} → ${s.category}`} />
          {(s.alsoMen || s.alsoWomen) && (
            <Row label="Also listed under" value={[s.alsoMen && `Men → ${s.alsoMen}`, s.alsoWomen && `Women → ${s.alsoWomen}`].filter(Boolean).join(" · ")} />
          )}
          <Row
            label="Price"
            value={
              s.salePrice !== null ? (
                <>
                  <s className="text-muted">{formatTaka(s.price)}</s> {formatTaka(s.salePrice)}
                </>
              ) : (
                formatTaka(s.price)
              )
            }
          />
          <Row label="Variants" value={`${s.colors} ${s.colors === 1 ? "colour" : "colours"} × ${s.variants / s.colors} ${s.variants / s.colors === 1 ? "size" : "sizes"} = ${s.variants}`} />
          <Row label="SKUs" value={<span className="font-mono text-[12px]">{s.skuFirst} … {s.skuLast}</span>} />
          <Row label="Stock" value={`${s.stockTotal} in total`} />
          <Row label="Preorder" value={preorderLabel(s.preorderAdvance)} />
          <Row label="Tags" value={s.tags.length ? s.tags.join(", ") : "none"} />
          <Row label="Status" value="Draft" />
        </dl>
      )}

      {item.state === "exists" && item.existing && (
        <p className="mt-2 text-[13px] text-muted">
          A product with this web address is already in your store:{" "}
          <Link href={`/admin/products/${item.existing.id}`} className="text-cyan underline">
            {item.existing.title}
          </Link>
          . It won&apos;t be touched.
        </p>
      )}

      {item.errors.length > 0 && (
        <ul className="mt-2 list-disc space-y-0.5 pl-5 text-[13px] text-error">
          {item.errors.map((m, i) => (
            <li key={i}>{m}</li>
          ))}
        </ul>
      )}
      {item.warnings.length > 0 && (
        <ul className="mt-2 list-disc space-y-0.5 pl-5 text-[13px] text-yellow">
          {item.warnings.map((m, i) => (
            <li key={i}>{m}</li>
          ))}
        </ul>
      )}

      {outcome && (
        <p
          className={`mt-2.5 border-t border-line pt-2.5 text-[13px] ${outcome.state === "failed" ? "text-error" : outcome.state === "created" ? "text-lime" : "text-muted"}`}
          aria-live="polite"
        >
          {outcome.state === "waiting" && "Waiting…"}
          {outcome.state === "creating" && "Creating…"}
          {outcome.state === "created" && (
            <>
              Created as a draft —{" "}
              <Link href={`/admin/products/${outcome.id}`} className="underline">
                open it
              </Link>
              {outcome.message && <span className="text-yellow"> · {outcome.message}</span>}
            </>
          )}
          {outcome.state === "failed" && `Not created: ${outcome.message}`}
        </p>
      )}
    </li>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="w-[72px] shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0">{value}</dd>
    </div>
  );
}
