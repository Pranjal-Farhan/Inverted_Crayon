"use client";

import { useEffect, useState } from "react";
import { getRecentlyViewed, trackRecentlyViewed } from "@/lib/recently-viewed";
import { ProductCard } from "@/components/ui/ProductCard";
import { Crown } from "@/components/brand/Crown";
import type { ProductDisplay } from "@/lib/product-view";

/** Records the current PDP visit and — separately — renders the rail of past visits. */
export function TrackRecentlyViewed({ productId }: { productId: string }) {
  useEffect(() => {
    trackRecentlyViewed(productId);
  }, [productId]);
  return null;
}

export function RecentlyViewedRail({ excludeProductId }: { excludeProductId: string }) {
  const [products, setProducts] = useState<ProductDisplay[] | null>(null);

  // Reads localStorage (an external system) and syncs the resulting
  // product list into state — the canonical read-external-then-fetch effect.
  useEffect(() => {
    const ids = getRecentlyViewed(excludeProductId);
    if (ids.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProducts([]);
      return;
    }
    fetch(`/api/products/by-ids?ids=${ids.join(",")}`)
      .then((r) => r.json())
      .then(setProducts)
      .catch(() => setProducts([]));
  }, [excludeProductId]);

  if (!products || products.length === 0) return null;

  return (
    <>
      <div className="sh my-8 flex items-center gap-3 font-scrawl text-[30px]">
        Recently viewed <Crown className="h-6 w-[34px] text-cyan" />
      </div>
      <div className="grid grid-cols-2 desktop:grid-cols-4 gap-5">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </>
  );
}
