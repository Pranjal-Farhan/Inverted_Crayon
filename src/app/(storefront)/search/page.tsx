import type { Metadata } from "next";
import { PLPView } from "@/components/storefront/PLPView";
import { parsePLPParams } from "@/lib/parse-plp-params";
import { SearchForm } from "@/components/storefront/SearchForm";
import type { RawSearchParams } from "@/lib/plp-url";

export const metadata: Metadata = { title: "Search" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const raw = await searchParams;
  const rest = parsePLPParams(raw);
  const q = rest.q?.trim();

  return (
    <>
      <div className="pagehead pb-1.5">
        <span className="font-scrawl text-[15px] text-pink">Find your fit</span>
        <h1 className="font-impact text-[clamp(40px,6vw,72px)] uppercase leading-[0.85] tracking-[1px]">Search</h1>
      </div>
      <SearchForm initialQuery={q ?? ""} />
      {q ? (
        <PLPView params={rest} title={`Results for "${q}"`} emptyMessage="Nothing matched. Try a different fit." />
      ) : (
        <p className="py-10 text-center text-muted">Type something to search the catalog.</p>
      )}
    </>
  );
}
