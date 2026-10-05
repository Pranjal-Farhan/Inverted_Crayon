"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getSizeGuideForProduct } from "@/actions/size-guide-lookup";
import { GENERIC_SIZE_GUIDE, type SizeGuideData } from "@/lib/size-guide";
import { SizeGuideReadTable } from "@/components/storefront/SizeGuideReadTable";

type State = { title: string | null; table: SizeGuideData; isProductSpecific: boolean; notFound: boolean };

const GENERIC_STATE: State = { title: null, table: GENERIC_SIZE_GUIDE, isProductSpecific: false, notFound: false };

/**
 * Reads the ?product= query param client-side (useSearchParams, which is why this needs the
 * Suspense boundary in size-guide/page.tsx) and, only when it's present, fetches that product's
 * own size guide via a server action. Starts from the exact same generic-chart state the page's
 * Suspense fallback renders, so there's no flash for the common case (no ?product= at all).
 */
export function SizeGuideClient() {
  const searchParams = useSearchParams();
  const slug = searchParams.get("product");
  const [state, setState] = useState<State>(GENERIC_STATE);

  useEffect(() => {
    if (!slug) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState(GENERIC_STATE);
      return;
    }
    let cancelled = false;
    getSizeGuideForProduct(slug).then((res) => {
      if (cancelled) return;
      setState(
        res
          ? { title: res.title, table: res.table, isProductSpecific: res.isProductSpecific, notFound: false }
          : { title: null, table: GENERIC_SIZE_GUIDE, isProductSpecific: false, notFound: true },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return (
    <>
      <p className="mx-auto mt-3 max-w-[52ch] text-center text-muted">
        {state.isProductSpecific ? (
          <>
            Measurements in inches for <span className="text-paper">{state.title}</span>.
          </>
        ) : state.notFound ? (
          "That product doesn't have measurements entered yet — here's our general reference chart. Oversized fits run 1 size roomy."
        ) : (
          "Measurements in inches. Oversized fits run 1 size roomy."
        )}
      </p>
      <SizeGuideReadTable table={state.table} />
    </>
  );
}
