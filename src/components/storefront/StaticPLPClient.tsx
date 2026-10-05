"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { ProductCard } from "@/components/ui/ProductCard";
import { StaticSortSelect } from "@/components/storefront/StaticSortSelect";
import { FilterDrawer } from "@/components/storefront/FilterDrawer";
import { applyPLPFilters } from "@/lib/plp-filter";
import { parsePLPParams } from "@/lib/parse-plp-params";
import { listParam, toggleListParam, toggleParam, setParam } from "@/lib/plp-url";
import { APPAREL_SIZES, ONE_SIZE } from "@/lib/sizes";
import type { PLPCatalogItem, PLPParams, PLPSort, PLPTag } from "@/lib/plp";

const PRICE_BANDS: { value: NonNullable<PLPParams["priceBand"]>; label: string }[] = [
  { value: "under2k", label: "Under ৳2k" },
  { value: "2k-3k", label: "৳2k–3k" },
  { value: "3kplus", label: "৳3k+" },
];

const SIZE_ORDER = [...APPAREL_SIZES, ONE_SIZE];

/**
 * Client-only filter/sort/pagination engine for the now-static PLP pages (/men/[category],
 * /women/[category], /new, /sale — see StaticPLPView.tsx). Mounted behind a <Suspense> boundary
 * because it calls useSearchParams(); per Next's docs that's what lets the static shell around it
 * prerender while this component renders purely on the client.
 *
 * Reads the initial filter state from useSearchParams() (synchronously correct even for a
 * freshly opened, shared filtered URL — no flash-then-correct for THIS component's own first
 * render, since it never has a server-rendered version to mismatch against). Every filter/sort/
 * page change after that updates local state and pushes the new query string with
 * window.history.pushState — never a Next.js navigation, so clicking a filter costs zero server
 * invocations. A popstate listener keeps state in sync with the browser's back/forward buttons,
 * which still work because pushState keeps writing real history entries.
 */
export function StaticPLPClient({
  catalog,
  emptyMessage,
  defaultSort,
  forcedTag,
}: {
  catalog: PLPCatalogItem[];
  emptyMessage: string;
  defaultSort?: PLPSort;
  forcedTag?: PLPTag;
}) {
  const pathname = usePathname();
  const initialSearchParams = useSearchParams();
  const [queryString, setQueryString] = useState(() => initialSearchParams.toString());

  useEffect(() => {
    function onPopState() {
      setQueryString(window.location.search.replace(/^\?/, ""));
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const sp = useMemo(() => new URLSearchParams(queryString), [queryString]);

  const rawParams = useMemo(() => {
    const raw: Record<string, string> = {};
    sp.forEach((value, key) => {
      raw[key] = value;
    });
    return raw;
  }, [sp]);

  const parsed = useMemo(() => parsePLPParams(rawParams), [rawParams]);
  // forcedTag mirrors the old server-side `{ ...rest, tag: "sale" }` spread on /sale — it always
  // wins, the same way the original did regardless of what's in the URL. defaultSort mirrors
  // /new's `rest.sort ?? "newest"` — only used when the URL doesn't specify one.
  const effectiveParams = useMemo(
    () => ({ ...parsed, sort: parsed.sort ?? defaultSort, tag: forcedTag ?? parsed.tag }),
    [parsed, defaultSort, forcedTag],
  );

  const results = useMemo(() => applyPLPFilters(catalog, effectiveParams), [catalog, effectiveParams]);

  const availableSizes = useMemo(() => {
    const set = new Set(catalog.flatMap((c) => c.sizes));
    return [...set].sort((a, b) => SIZE_ORDER.indexOf(a) - SIZE_ORDER.indexOf(b));
  }, [catalog]);
  const availableColors = useMemo(() => [...new Set(catalog.flatMap((c) => c.colors))], [catalog]);

  const navigate = useCallback(
    (href: string) => {
      const qs = href.replace(/^\?/, "");
      const url = qs ? `${pathname}?${qs}` : pathname;
      window.history.pushState(null, "", url);
      setQueryString(qs);
    },
    [pathname],
  );

  const activeChips: { label: string; href: string }[] = [];
  if (effectiveParams.sizes?.length) {
    for (const s of effectiveParams.sizes) activeChips.push({ label: `Size: ${s}`, href: toggleListParam(sp, "sizes", s) });
  }
  if (effectiveParams.colors?.length) {
    for (const c of effectiveParams.colors) activeChips.push({ label: c, href: toggleListParam(sp, "colors", c) });
  }
  if (effectiveParams.priceBand) {
    const band = PRICE_BANDS.find((b) => b.value === effectiveParams.priceBand);
    activeChips.push({ label: band?.label ?? effectiveParams.priceBand, href: setParam(sp, "price", null) });
  }
  // Only show a removable chip for `tag` when it's not the page's own forced tag (matches the
  // original: /sale never showed a dismissible "sale" chip for its own forced filter).
  if (effectiveParams.tag && effectiveParams.tag !== forcedTag) {
    activeChips.push({ label: effectiveParams.tag, href: setParam(sp, "tag", null) });
  }
  if (effectiveParams.inStockOnly) activeChips.push({ label: "In stock", href: setParam(sp, "stock", null) });

  return (
    <div className="plp grid grid-cols-1 gap-7 py-6 desktop:grid-cols-[210px_1fr]">
      <FilterDrawer>
        <FilterGroup title="Size">
          {availableSizes.map((s) => (
            <FilterChip key={s} active={listParam(sp, "sizes").includes(s)} href={toggleListParam(sp, "sizes", s)} onNavigate={navigate}>
              {s}
            </FilterChip>
          ))}
        </FilterGroup>
        <FilterGroup title="Color">
          {availableColors.map((c) => (
            <FilterChip key={c} active={listParam(sp, "colors").includes(c)} href={toggleListParam(sp, "colors", c)} onNavigate={navigate}>
              {c}
            </FilterChip>
          ))}
        </FilterGroup>
        <FilterGroup title="Price">
          {PRICE_BANDS.map((b) => (
            <FilterChip key={b.value} active={effectiveParams.priceBand === b.value} href={toggleParam(sp, "price", b.value)} onNavigate={navigate}>
              {b.label}
            </FilterChip>
          ))}
        </FilterGroup>
        <FilterGroup title="Tag">
          <FilterChip active={effectiveParams.tag === "preorder"} href={toggleParam(sp, "tag", "preorder")} onNavigate={navigate}>
            Preorder
          </FilterChip>
          <FilterChip active={effectiveParams.tag === "sale"} href={toggleParam(sp, "tag", "sale")} onNavigate={navigate}>
            Sale
          </FilterChip>
          <FilterChip active={effectiveParams.tag === "new"} href={toggleParam(sp, "tag", "new")} onNavigate={navigate}>
            New
          </FilterChip>
        </FilterGroup>
        <FilterGroup title="Availability">
          <FilterChip active={Boolean(effectiveParams.inStockOnly)} href={setParam(sp, "stock", effectiveParams.inStockOnly ? null : "1")} onNavigate={navigate}>
            In stock
          </FilterChip>
        </FilterGroup>
      </FilterDrawer>

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3.5">
          <span className="font-label text-sm tracking-[1.4px] text-muted">{results.total} products</span>
          <StaticSortSelect
            current={effectiveParams.sort ?? "newest"}
            onChange={(value) => navigate(setParam(sp, "sort", value))}
          />
        </div>

        {activeChips.length > 0 && (
          <div className="mb-3.5 flex flex-wrap gap-1.5">
            {activeChips.map((chip) => (
              <button
                key={chip.label}
                onClick={() => navigate(chip.href)}
                className="bg-panel-2 border border-line-2 px-2.5 py-0.5 text-[12px] hover:border-error"
              >
                {chip.label} ✕
              </button>
            ))}
          </div>
        )}

        {results.items.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-muted">{emptyMessage}</p>
            <button onClick={() => navigate("?")} className="mt-3 inline-block font-label text-sm tracking-[1px] text-lime">
              Reset filters
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 desktop:grid-cols-3 gap-5">
              {results.items.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
            {results.total > results.pageSize && (
              <Pagination sp={sp} page={results.page} pageSize={results.pageSize} total={results.total} onNavigate={navigate} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h5 className="mb-2 mt-4 font-label text-[15px] tracking-[1.4px]">{title}</h5>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function FilterChip({
  active,
  href,
  onNavigate,
  children,
}: {
  active: boolean;
  href: string;
  onNavigate: (href: string) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={() => onNavigate(href)}
      className={`border px-2.5 py-1 text-xs ${active ? "border-lime text-lime" : "border-line-2 text-[#ddd] hover:border-lime hover:text-lime"}`}
    >
      {children}
    </button>
  );
}

function Pagination({
  sp,
  page,
  pageSize,
  total,
  onNavigate,
}: {
  sp: URLSearchParams;
  page: number;
  pageSize: number;
  total: number;
  onNavigate: (href: string) => void;
}) {
  const totalPages = Math.ceil(total / pageSize);
  return (
    <div className="mt-8 flex justify-center gap-2">
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
        const next = new URLSearchParams(sp);
        if (p === 1) next.delete("page");
        else next.set("page", String(p));
        return (
          <button
            key={p}
            onClick={() => onNavigate(`?${next.toString()}`)}
            className={`h-9 w-9 grid place-items-center border font-label text-sm ${
              p === page ? "border-lime text-lime" : "border-line-2 text-muted hover:border-lime"
            }`}
          >
            {p}
          </button>
        );
      })}
    </div>
  );
}
