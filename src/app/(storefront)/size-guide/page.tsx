import type { Metadata } from "next";
import { Suspense } from "react";
import { SizeGuideClient } from "@/components/storefront/SizeGuideClient";

export const metadata: Metadata = { title: "Size Guide", alternates: { canonical: "/size-guide" } };

// Fully static — this file has zero DB reads of its own (the lookup lives in the
// getSizeGuideForProduct server action, called client-side by SizeGuideClient.tsx) and no
// searchParams read, so there's nothing left to revalidate on a timer.
//
// There is no generic/default chart: a product only has a size guide when its admins entered one,
// and SizeGuideClient says so plainly when it doesn't (or when no ?product= is given). The Suspense
// fallback is empty on purpose — a visit from a product page (?product=…) must not flash a
// message meant for the bare URL before its own result arrives.
export default function SizeGuidePage() {
  return (
    <section className="pg pb-16">
      <div className="mx-auto max-w-[760px]">
        <div className="pt-8 pb-1.5 text-center">
          <h1 className="font-impact text-[clamp(40px,6vw,72px)] uppercase leading-[0.85] tracking-[1px]">
            Size <span className="text-lime">Guide</span>
          </h1>
        </div>
        <Suspense fallback={null}>
          <SizeGuideClient />
        </Suspense>
      </div>
    </section>
  );
}
