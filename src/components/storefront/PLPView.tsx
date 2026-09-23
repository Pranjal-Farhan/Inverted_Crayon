import Link from "next/link";
import { ProductCard } from "@/components/ui/ProductCard";
import { SortSelect } from "@/components/storefront/SortSelect";
import { FilterDrawer } from "@/components/storefront/FilterDrawer";
import type { PLPParams } from "@/lib/plp";
import { getPLPResults } from "@/lib/plp";
import { listParam, toggleListParam, toggleParam, setParam } from "@/lib/plp-url";

const PRICE_BANDS: { value: NonNullable<PLPParams["priceBand"]>; label: string }[] = [
  { value: "under2k", label: "Under ৳2k" },
  { value: "2k-3k", label: "৳2k–3k" },
  { value: "3kplus", label: "৳3k+" },
];

export async function PLPView({
  params,
  title,
  breadcrumb,
  emptyMessage = "Nothing here yet — try clearing a filter.",
}: {
  params: PLPParams;
  title: React.ReactNode;
  breadcrumb?: React.ReactNode;
  emptyMessage?: string;
}) {
  const results = await getPLPResults(params);
  const sp = new URLSearchParams();
  if (params.sizes?.length) sp.set("sizes", params.sizes.join(","));
  if (params.colors?.length) sp.set("colors", params.colors.join(","));
  if (params.priceBand) sp.set("price", params.priceBand);
  if (params.tag) sp.set("tag", params.tag);
  if (params.inStockOnly) sp.set("stock", "1");
  if (params.sort) sp.set("sort", params.sort);
  if (params.q) sp.set("q", params.q);
  const queryString = sp.toString();

  const activeChips: { label: string; href: string }[] = [];
  if (params.sizes?.length) {
    for (const s of params.sizes) activeChips.push({ label: `Size: ${s}`, href: toggleListParam(sp, "sizes", s) });
  }
  if (params.colors?.length) {
    for (const c of params.colors) activeChips.push({ label: c, href: toggleListParam(sp, "colors", c) });
  }
  if (params.priceBand) {
    const band = PRICE_BANDS.find((b) => b.value === params.priceBand);
    activeChips.push({ label: band?.label ?? params.priceBand, href: setParam(sp, "price", null) });
  }
  if (params.tag) activeChips.push({ label: params.tag, href: setParam(sp, "tag", null) });
  if (params.inStockOnly) activeChips.push({ label: "In stock", href: setParam(sp, "stock", null) });

  return (
    <section className="pg pb-16">
      <div className="pagehead pb-0">
        {breadcrumb}
        <h1 className="font-impact text-[clamp(40px,6vw,72px)] uppercase leading-[0.85] tracking-[1px]">{title}</h1>
      </div>

      <div className="plp grid grid-cols-1 gap-7 py-6 desktop:grid-cols-[210px_1fr]">
        <FilterDrawer>
          <FilterGroup title="Size">
            {results.availableSizes.map((s) => (
              <FilterChip key={s} active={listParam(sp, "sizes").includes(s)} href={toggleListParam(sp, "sizes", s)}>
                {s}
              </FilterChip>
            ))}
          </FilterGroup>
          <FilterGroup title="Color">
            {results.availableColors.map((c) => (
              <FilterChip key={c} active={listParam(sp, "colors").includes(c)} href={toggleListParam(sp, "colors", c)}>
                {c}
              </FilterChip>
            ))}
          </FilterGroup>
          <FilterGroup title="Price">
            {PRICE_BANDS.map((b) => (
              <FilterChip key={b.value} active={params.priceBand === b.value} href={toggleParam(sp, "price", b.value)}>
                {b.label}
              </FilterChip>
            ))}
          </FilterGroup>
          <FilterGroup title="Tag">
            <FilterChip active={params.tag === "preorder"} href={toggleParam(sp, "tag", "preorder")}>
              Preorder
            </FilterChip>
            <FilterChip active={params.tag === "sale"} href={toggleParam(sp, "tag", "sale")}>
              Sale
            </FilterChip>
            <FilterChip active={params.tag === "new"} href={toggleParam(sp, "tag", "new")}>
              New
            </FilterChip>
          </FilterGroup>
          <FilterGroup title="Availability">
            <FilterChip active={Boolean(params.inStockOnly)} href={setParam(sp, "stock", params.inStockOnly ? null : "1")}>
              In stock
            </FilterChip>
          </FilterGroup>
        </FilterDrawer>

        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-3.5">
            <span className="font-label text-sm tracking-[1.4px] text-muted">{results.total} products</span>
            <SortSelect current={params.sort ?? "newest"} queryString={queryString} />
          </div>

          {activeChips.length > 0 && (
            <div className="mb-3.5 flex flex-wrap gap-1.5">
              {activeChips.map((chip) => (
                <Link
                  key={chip.label}
                  href={chip.href}
                  className="bg-panel-2 border border-line-2 px-2.5 py-0.5 text-[12px] hover:border-error"
                >
                  {chip.label} ✕
                </Link>
              ))}
            </div>
          )}

          {results.items.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-muted">{emptyMessage}</p>
              <Link href="?" className="mt-3 inline-block font-label text-sm tracking-[1px] text-lime">
                Reset filters
              </Link>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 desktop:grid-cols-3 gap-5">
                {results.items.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
              {results.total > results.pageSize && (
                <Pagination sp={sp} page={results.page} pageSize={results.pageSize} total={results.total} />
              )}
            </>
          )}
        </div>
      </div>
    </section>
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

function FilterChip({ active, href, children }: { active: boolean; href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`border px-2.5 py-1 text-xs ${active ? "border-lime text-lime" : "border-line-2 text-[#ddd] hover:border-lime hover:text-lime"}`}
    >
      {children}
    </Link>
  );
}

function Pagination({
  sp,
  page,
  pageSize,
  total,
}: {
  sp: URLSearchParams;
  page: number;
  pageSize: number;
  total: number;
}) {
  const totalPages = Math.ceil(total / pageSize);
  return (
    <div className="mt-8 flex justify-center gap-2">
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
        const next = new URLSearchParams(sp);
        if (p === 1) next.delete("page");
        else next.set("page", String(p));
        return (
          <Link
            key={p}
            href={`?${next.toString()}`}
            className={`h-9 w-9 grid place-items-center border font-label text-sm ${
              p === page ? "border-lime text-lime" : "border-line-2 text-muted hover:border-lime"
            }`}
          >
            {p}
          </Link>
        );
      })}
    </div>
  );
}
