import { Suspense } from "react";
import { ProductCard } from "@/components/ui/ProductCard";
import { StaticPLPClient } from "@/components/storefront/StaticPLPClient";
import { getPLPCatalog } from "@/lib/plp";
import type { PLPParams, PLPSort, PLPTag } from "@/lib/plp";

/**
 * Server shell for the now-static /men/[category], /women/[category], /new, and /sale pages.
 * Fetches the cached, unfiltered catalog for this gender/category scope and renders it twice:
 * once as the Suspense fallback (the actual static HTML a crawler or a no-JS visitor sees — the
 * full, unfiltered product list, every item a real link, nothing hidden behind client-only
 * filtering) and once inside StaticPLPClient, which replaces the fallback on hydration and does
 * all filtering/sorting/pagination from there. See StaticPLPClient.tsx for why that needs a
 * Suspense boundary (it calls useSearchParams()) and src/lib/plp.ts for the cached fetch.
 */
export async function StaticPLPView({
  gender,
  categorySlug,
  title,
  breadcrumb,
  emptyMessage = "Nothing here yet — try clearing a filter.",
  defaultSort,
  forcedTag,
}: {
  gender?: PLPParams["gender"];
  categorySlug?: string;
  title: React.ReactNode;
  breadcrumb?: React.ReactNode;
  emptyMessage?: string;
  defaultSort?: PLPSort;
  forcedTag?: PLPTag;
}) {
  const catalog = await getPLPCatalog(gender, categorySlug);

  return (
    <section className="pg pb-16">
      <div className="pagehead pb-0">
        {breadcrumb}
        <h1 className="font-impact text-[clamp(40px,6vw,72px)] uppercase leading-[0.85] tracking-[1px]">{title}</h1>
      </div>

      <Suspense fallback={<StaticPLPFallback catalog={catalog} />}>
        <StaticPLPClient catalog={catalog} emptyMessage={emptyMessage} defaultSort={defaultSort} forcedTag={forcedTag} />
      </Suspense>
    </section>
  );
}

function StaticPLPFallback({ catalog }: { catalog: Awaited<ReturnType<typeof getPLPCatalog>> }) {
  return (
    <div className="plp py-6">
      <div className="grid grid-cols-2 desktop:grid-cols-3 gap-5">
        {catalog.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </div>
  );
}
