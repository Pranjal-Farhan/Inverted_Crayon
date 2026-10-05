import type { Metadata } from "next";
import { StaticPLPView } from "@/components/storefront/StaticPLPView";

export const metadata: Metadata = { title: "Sale", alternates: { canonical: "/sale" } };

// Now fully static (○/ISR) — no searchParams read here at all. forcedTag="sale" matches the old
// server-side `{ ...rest, tag: "sale" }` spread: it always wins over whatever's in the URL, same
// as before. 300s revalidate (not 3600s) because this page's entire contents hinge on which
// campaigns are currently active, and a campaign's endsAt passing is exactly the kind of boundary
// that needs a tight timer — see the matching comment on men/[category]/page.tsx.
export const revalidate = 300;

export default function SalePage() {
  return (
    <StaticPLPView
      forcedTag="sale"
      title="Sale"
      breadcrumb={<p className="font-scrawl text-[15px] text-pink">Live now</p>}
      emptyMessage="Nothing on sale right now — check back soon."
    />
  );
}
