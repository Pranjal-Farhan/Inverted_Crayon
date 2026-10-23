"use client";

import Image from "next/image";
import { useMemo, useState, useTransition } from "react";
import { reconcileLedger } from "@/actions/admin-stock";
import { Kpi } from "@/components/admin/Kpi";
import { formatTaka } from "@/lib/money";
import type { InventoryProduct } from "@/lib/inventory";
import { StockOverlay } from "./StockOverlay";

type View = "all" | "low" | "soldout-sizes" | "nothing";
type Sort = "name" | "restock" | "units-asc" | "units-desc" | "worth-desc";

const sum = <T,>(list: T[], f: (x: T) => number) => list.reduce((t, x) => t + f(x), 0);
const isLow = (v: { stock: number; low: number }) => v.stock > 0 && v.stock <= v.low;

/** Per size (colours added together): the chip on a product row. */
function sizeChips(p: InventoryProduct) {
  const bySize = new Map<string, { size: string; qty: number; low: boolean; out: boolean; detail: string[] }>();
  for (const v of p.variants) {
    const c = bySize.get(v.size) ?? { size: v.size, qty: 0, low: false, out: false, detail: [] };
    c.qty += v.stock;
    c.low ||= isLow(v);
    c.out ||= v.stock <= 0;
    c.detail.push(`${v.color}: ${v.stock}`);
    bySize.set(v.size, c);
  }
  return [...bySize.values()];
}

const productUnits = (p: InventoryProduct) => sum(p.variants, (v) => v.stock);
const productWorth = (p: InventoryProduct) => sum(p.variants, (v) => v.stock * v.price);
const productCostValue = (p: InventoryProduct) => (p.cost != null ? productUnits(p) * p.cost : null);

export function InventoryManager({ products: serverProducts, canSeeCost, mismatches }: { products: InventoryProduct[]; canSeeCost: boolean; mismatches: string[] }) {
  // The page's data comes from the server; counts changed in the panel are applied here at once from
  // the true number the server answers with, and the server's next render replaces them again.
  const [products, setProducts] = useState(serverProducts);
  const [seenServer, setSeenServer] = useState(serverProducts);
  if (seenServer !== serverProducts) {
    setSeenServer(serverProducts);
    setProducts(serverProducts);
  }

  const [q, setQ] = useState("");
  const [view, setView] = useState<View>("all");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState<Sort>("name");
  const [openId, setOpenId] = useState<string | null>(null);

  const categories = useMemo(() => [...new Set(products.map((p) => p.category))].sort(), [products]);

  const totals = useMemo(() => {
    const variants = products.flatMap((p) => p.variants);
    const costed = products.filter((p) => p.cost != null);
    return {
      products: products.length,
      sizes: variants.length,
      units: sum(variants, (v) => v.stock),
      worth: sum(products, productWorth),
      cost: sum(costed, (p) => productCostValue(p) ?? 0),
      worthOfCosted: sum(costed, productWorth),
      uncosted: products.filter((p) => p.cost == null && productUnits(p) > 0).length,
      low: variants.filter(isLow).length,
      out: variants.filter((v) => v.stock <= 0).length,
    };
  }, [products]);

  const counts = useMemo(
    () => ({
      all: products.length,
      low: products.filter((p) => p.variants.some(isLow)).length,
      "soldout-sizes": products.filter((p) => p.variants.some((v) => v.stock <= 0)).length,
      nothing: products.filter((p) => p.variants.length > 0 && productUnits(p) === 0).length,
    }),
    [products],
  );

  const shown = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const list = products.filter((p) => {
      if (words.length && !words.every((w) => p.search.includes(w))) return false;
      if (status === "active" && !p.active) return false;
      if (status === "draft" && p.active) return false;
      if (category && p.category !== category) return false;
      if (view === "low") return p.variants.some(isLow);
      if (view === "soldout-sizes") return p.variants.some((v) => v.stock <= 0);
      if (view === "nothing") return p.variants.length > 0 && productUnits(p) === 0;
      return true;
    });
    const worstRatio = (p: InventoryProduct) => Math.min(...p.variants.map((v) => v.stock / Math.max(v.low, 1)), Infinity);
    const sorters: Record<Sort, (a: InventoryProduct, b: InventoryProduct) => number> = {
      name: (a, b) => a.title.localeCompare(b.title),
      restock: (a, b) => worstRatio(a) - worstRatio(b) || a.title.localeCompare(b.title),
      "units-asc": (a, b) => productUnits(a) - productUnits(b),
      "units-desc": (a, b) => productUnits(b) - productUnits(a),
      "worth-desc": (a, b) => productWorth(b) - productWorth(a),
    };
    return [...list].sort(sorters[sort]);
  }, [products, q, status, category, view, sort]);

  const open = products.find((p) => p.id === openId) ?? null;

  function setQty(variantId: string, qty: number) {
    setProducts((all) => all.map((p) => ({ ...p, variants: p.variants.map((v) => (v.id === variantId ? { ...v, stock: qty } : v)) })));
  }

  const VIEWS: { id: View; label: string }[] = [
    { id: "all", label: "All products" },
    { id: "low", label: "Low stock" },
    { id: "soldout-sizes", label: "Sizes sold out" },
    { id: "nothing", label: "Nothing left" },
  ];

  return (
    <div>
      {mismatches.length > 0 && <LedgerBanner lines={mismatches} canRepair={canSeeCost} />}

      <section aria-label="Total inventory" className="mb-4.5">
        <div className={`grid grid-cols-2 gap-4 ${canSeeCost ? "desktop:grid-cols-5" : "desktop:grid-cols-3"}`}>
          <Kpi label="Units in stock" value={totals.units.toLocaleString("en-US")} accent="cyan" delta={`${totals.products} products · ${totals.sizes} sizes`} />
          {canSeeCost && <Kpi label="Inventory at buying cost" value={formatTaka(totals.cost)} accent="yellow" delta={totals.uncosted ? `${totals.uncosted} product${totals.uncosted === 1 ? "" : "s"} in stock have no purchase cost yet` : "what it cost us"} />}
          <Kpi label="Worth when sold" value={formatTaka(totals.worth)} accent="lime" delta="at today's selling prices" />
          {canSeeCost && (
            <Kpi
              label="Profit once sold"
              value={totals.cost === 0 && totals.uncosted > 0 ? "—" : formatTaka(totals.worthOfCosted - totals.cost)}
              accent="lime"
              delta={totals.uncosted ? "set purchase costs on products to see this" : "worth minus buying cost"}
            />
          )}
          <Kpi label="Needs attention" value={`${totals.low + totals.out}`} accent="pink" delta={`${totals.low} low · ${totals.out} sold out`} />
        </div>
      </section>

      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, SKU, size, colour, category, tag…"
          aria-label="Search inventory"
          className="min-w-[260px] flex-1 border border-line-2 bg-panel px-3 py-2 text-sm outline-none focus:border-lime desktop:max-w-[420px]"
        />
        <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category" className="border border-line-2 bg-panel px-2.5 py-2 text-sm">
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Product status" className="border border-line-2 bg-panel px-2.5 py-2 text-sm">
          <option value="">Active + draft</option>
          <option value="active">Active only</option>
          <option value="draft">Draft only</option>
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort by" className="border border-line-2 bg-panel px-2.5 py-2 text-sm">
          <option value="name">Sort: name A–Z</option>
          <option value="restock">Sort: needs restock first</option>
          <option value="units-asc">Sort: fewest units</option>
          <option value="units-desc">Sort: most units</option>
          <option value="worth-desc">Sort: highest worth</option>
        </select>
      </div>

      <nav className="mb-3.5 flex flex-wrap gap-2" aria-label="Stock level">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => setView(v.id)}
            aria-pressed={view === v.id}
            className={`border px-3 py-1.5 text-[13px] ${view === v.id ? "border-lime text-lime" : "border-line-2 text-muted hover:border-lime"}`}
          >
            {v.label} <span className="text-muted-2">· {counts[v.id]}</span>
          </button>
        ))}
      </nav>

      <div className="border border-line bg-panel">
        <div className="hidden grid-cols-[64px_minmax(160px,1.1fr)_minmax(220px,2fr)_84px_120px_120px_20px] items-center gap-3 border-b border-line-2 px-3 py-2.5 text-left text-muted desktop:grid">
          {["", "Product", "Sizes in stock", "Units", canSeeCost ? "At buying cost" : "", "Worth when sold", ""].map((h, i) => (
            <span key={i} className={`font-label text-[13px] tracking-[0.8px] ${i >= 3 && i <= 5 ? "text-right" : ""}`}>
              {h}
            </span>
          ))}
        </div>
        <ul>
          {shown.map((p) => {
            const units = productUnits(p);
            const costValue = productCostValue(p);
            return (
              <li key={p.id} className="border-b border-line last:border-b-0">
                <button
                  type="button"
                  onClick={() => setOpenId(p.id)}
                  aria-label={`Open stock for ${p.title}`}
                  className="grid w-full grid-cols-[64px_1fr] items-center gap-x-3 gap-y-2 px-3 py-3 text-left hover:bg-panel-2 focus-visible:bg-panel-2 desktop:grid-cols-[64px_minmax(160px,1.1fr)_minmax(220px,2fr)_84px_120px_120px_20px]"
                >
                  <span className="relative block h-[56px] w-[56px] overflow-hidden border border-line-2 bg-panel-2">
                    {p.image ? (
                      <Image src={p.image} alt="" fill sizes="56px" quality={70} className="object-cover" />
                    ) : (
                      <span className="font-label grid h-full w-full place-items-center text-center text-[9px] leading-tight tracking-[1px] text-muted-2">NO IMAGE</span>
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-medium">{p.title}</span>
                    <span className="block truncate text-[12px] text-muted">
                      {p.category} · {p.gender} · {p.active ? "Active" : <span className="text-yellow">Draft</span>}
                    </span>
                  </span>
                  <span className="col-span-2 flex flex-wrap gap-1.5 desktop:col-span-1">
                    {p.variants.length === 0 && <span className="text-[12px] text-muted-2">No sizes yet</span>}
                    {sizeChips(p).map((c) => (
                      <span
                        key={c.size}
                        title={c.detail.join("\n")}
                        className={`border px-2 py-0.5 text-[12px] tabular-nums ${c.qty === 0 ? "border-error/50 text-error" : c.low ? "border-yellow/60 text-yellow" : "border-line-2 text-paper"}`}
                      >
                        {c.size} <strong className="font-semibold">{c.qty}</strong>
                      </span>
                    ))}
                  </span>
                  <span className={`text-right text-[15px] tabular-nums desktop:block ${units === 0 ? "text-error" : ""}`}>
                    <span className="mr-1 text-[11px] text-muted-2 desktop:hidden">Units</span>
                    {units}
                  </span>
                  <span className="hidden text-right text-[14px] tabular-nums text-muted desktop:block">
                    {canSeeCost ? (costValue != null ? formatTaka(costValue) : <span className="text-yellow" title="No purchase cost entered for this product">no cost set</span>) : ""}
                  </span>
                  <span className="hidden text-right text-[14px] tabular-nums desktop:block">{formatTaka(productWorth(p))}</span>
                  <span aria-hidden className="hidden text-muted-2 desktop:block">
                    ›
                  </span>
                </button>
              </li>
            );
          })}
          {shown.length === 0 && (
            <li className="px-4 py-8 text-center text-muted">{products.length === 0 ? "No products yet." : "No products match these filters."}</li>
          )}
        </ul>
      </div>
      <p className="mt-2.5 text-[12px] text-muted-2">
        {shown.length} of {products.length} products shown. A size is “low” at or below its low-stock level. Click a product to see every size and colour and add stock.
      </p>

      {open && <StockOverlay product={open} canSeeCost={canSeeCost} onQty={setQty} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function LedgerBanner({ lines, canRepair }: { lines: string[]; canRepair: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  return (
    <div role="alert" className="mb-4.5 border border-error/40 bg-error/[0.07] px-4 py-3 text-sm">
      <p className="font-label text-[12px] tracking-[1.2px] text-error">STOCK HISTORY DOESN&apos;T ADD UP</p>
      <p className="mt-1 text-muted">
        {lines.length} size{lines.length === 1 ? " has" : "s have"} a stock count that doesn&apos;t match its recorded history. The counts shown are what sells, so nothing is wrong with selling — but the history needs repairing so it can be trusted.
      </p>
      <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-[12px] text-muted">
        {lines.slice(0, 5).map((l) => (
          <li key={l}>{l}</li>
        ))}
        {lines.length > 5 && <li>… and {lines.length - 5} more</li>}
      </ul>
      {canRepair ? (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError("");
              try {
                const r = await reconcileLedger();
                if (!r.ok) setError(r.error);
                else setDone(`History repaired for ${r.fixed ?? 0} size${r.fixed === 1 ? "" : "s"}.`);
              } catch {
                setError("Couldn't reach the server — nothing was changed. Try again.");
              }
            })
          }
          className="mt-2.5 border border-error px-3 py-1.5 text-[13px] text-error hover:bg-error/10 disabled:opacity-50"
        >
          {pending ? "Repairing…" : "Repair the history"}
        </button>
      ) : (
        <p className="mt-2 text-[12px] text-muted-2">Ask an admin to repair it.</p>
      )}
      {error && <p className="mt-2 text-[13px] text-error">{error}</p>}
      {done && <p className="mt-2 text-[13px] text-lime">{done}</p>}
    </div>
  );
}
