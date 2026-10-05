import type { Metadata } from "next";
import { StaticPLPView } from "@/components/storefront/StaticPLPView";

export const metadata: Metadata = { title: "Sale", alternates: { canonical: "/sale" } };

// Now fully static (○/ISR) — no searchParams read here at all. forcedTag="sale" matches the old
// server-side `{ ...rest, tag: "sale" }` spread: it always wins over whatever's in the URL, same
// as before.
export const revalidate = 3600;

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
