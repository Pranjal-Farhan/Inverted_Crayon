import type { Metadata } from "next";
import { PLPView } from "@/components/storefront/PLPView";
import { parsePLPParams } from "@/lib/parse-plp-params";
import type { RawSearchParams } from "@/lib/plp-url";

export const metadata: Metadata = { title: "Sale" };

// Stays dynamic (ƒ) — reads searchParams for server-side sort/filter; see the Fix 2e note in
// men/[category]/page.tsx. The underlying catalog fetch is cached (src/lib/plp.ts).
export default async function SalePage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const rest = parsePLPParams(await searchParams);
  return (
    <PLPView
      params={{ ...rest, tag: "sale" }}
      title="Sale"
      breadcrumb={<p className="font-scrawl text-[15px] text-pink">Live now</p>}
      emptyMessage="Nothing on sale right now — check back soon."
    />
  );
}
