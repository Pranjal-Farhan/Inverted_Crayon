import type { Metadata } from "next";
import { StaticPLPView } from "@/components/storefront/StaticPLPView";

export const metadata: Metadata = { title: "New Arrivals", alternates: { canonical: "/new" } };

// Now fully static (○/ISR) — no searchParams read here at all. Defaults to "newest" sort
// (matching the old server-side `rest.sort ?? "newest"`), but the sort control can still
// override that client-side.
export const revalidate = 3600;

export default function NewArrivalsPage() {
  return (
    <StaticPLPView
      defaultSort="newest"
      title={
        <>
          New <span className="text-lime">Arrivals</span>
        </>
      }
      breadcrumb={<p className="font-scrawl text-[15px] text-pink">Just dropped</p>}
    />
  );
}
