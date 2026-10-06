import type { Metadata } from "next";
import { Suspense } from "react";
import { GENERIC_SIZE_GUIDE } from "@/lib/size-guide";
import { SizeGuideReadTable } from "@/components/storefront/SizeGuideReadTable";
import { SizeGuideClient } from "@/components/storefront/SizeGuideClient";

export const metadata: Metadata = { title: "Size Guide", alternates: { canonical: "/size-guide" } };

// Now fully static — this file has zero DB reads of its own (moved into the
// getSizeGuideForProduct server action, called client-side by SizeGuideClient.tsx) and no
// searchParams read, so there's nothing left to revalidate on a timer.

// The original markup kept the intro paragraph inside the same centered heading block as the
// <h1> (sharing its text-center) and the table as a separate, non-centered sibling below. The
// Suspense boundary has to wrap both together (one fetch feeds both), so the centering is
// applied directly to the paragraph here instead of inherited from an ancestor — same rendered
// result, without needing the Suspense boundary to straddle two different parent elements.
function GenericSizeGuideIntro() {
  return (
    <p className="mx-auto mt-3 max-w-[52ch] text-center text-muted">Measurements in inches. Oversized fits run 1 size roomy.</p>
  );
}

export default function SizeGuidePage() {
  return (
    <section className="pg pb-16">
      <div className="mx-auto max-w-[760px]">
        <div className="pt-8 pb-1.5 text-center">
          <h1 className="font-impact text-[clamp(40px,6vw,72px)] uppercase leading-[0.85] tracking-[1px]">
            Size <span className="text-lime">Guide</span>
          </h1>
        </div>
        <Suspense
          fallback={
            <>
              <GenericSizeGuideIntro />
              <SizeGuideReadTable table={GENERIC_SIZE_GUIDE} />
            </>
          }
        >
          <SizeGuideClient />
        </Suspense>
      </div>
    </section>
  );
}
