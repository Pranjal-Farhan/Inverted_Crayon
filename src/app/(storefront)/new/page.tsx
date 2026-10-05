import type { Metadata } from "next";
import { StaticPLPView } from "@/components/storefront/StaticPLPView";

export const metadata: Metadata = { title: "New Arrivals", alternates: { canonical: "/new" } };

// Now fully static (○/ISR) — no searchParams read here at all. Defaults to "newest" sort
// (matching the old server-side `rest.sort ?? "newest"`), but the sort control can still
// override that client-side. 300s revalidate, not 3600s — see the matching comment on
// men/[category]/page.tsx (campaign boundaries can change sale pricing with no admin action).
export const revalidate = 300;

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
