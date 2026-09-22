import type { Metadata } from "next";
import { PLPView } from "@/components/storefront/PLPView";
import { parsePLPParams } from "@/lib/parse-plp-params";
import type { RawSearchParams } from "@/lib/plp-url";

export const metadata: Metadata = { title: "Sale" };

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
