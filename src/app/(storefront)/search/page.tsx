import type { Metadata } from "next";
import { PLPView } from "@/components/storefront/PLPView";
import { parsePLPParams } from "@/lib/parse-plp-params";
import { SearchForm } from "@/components/storefront/SearchForm";
import type { RawSearchParams } from "@/lib/plp-url";

export const metadata: Metadata = { title: "Search" };

// Deliberately NOT converted to the static/client-filtered pattern used by
// /men/[category], /women/[category], /new and /sale (see StaticPLPView.tsx). Those pages have a
// fixed, enumerable scope (a gender/category combination, or "everything") that can be fetched
// and cached once and then filtered client-side. A free-text search query is unbounded — there's
// no finite set of "all possible /search pages" to prerender or cache a shell for, and shipping
// the *entire* catalog to the client just so it can be searched offline would make this page's
// JS payload scale with the whole store rather than with one query. So this one stays genuinely
// dynamic: it reads searchParams server-side and reuses the original server-filtered PLPView,
// same as before. The underlying catalog fetch it calls into is still cached (src/lib/plp.ts).
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
