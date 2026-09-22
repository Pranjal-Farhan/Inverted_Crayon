import type { Metadata } from "next";
import { PLPView } from "@/components/storefront/PLPView";
import { parsePLPParams } from "@/lib/parse-plp-params";
import type { RawSearchParams } from "@/lib/plp-url";

export const metadata: Metadata = { title: "New Arrivals" };

export default async function NewArrivalsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const rest = parsePLPParams(await searchParams);
  return (
    <PLPView
      params={{ ...rest, sort: rest.sort ?? "newest" }}
      title={
        <>
          New <span className="text-lime">Arrivals</span>
        </>
      }
      breadcrumb={<p className="font-scrawl text-[15px] text-pink">Just dropped</p>}
    />
  );
}
