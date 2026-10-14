"use client";

import { useState, useTransition } from "react";
import { ProductCard } from "@/components/ui/ProductCard";
import { Button } from "@/components/ui/Button";
import { EndOfProducts } from "@/components/brand/EndOfProducts";
import type { ProductDisplay } from "@/lib/product-view";

/** Homepage "New In" grid — starts with the server-rendered first page (20 cards, shipped with
 * the ISR'd homepage itself) and fetches further pages of 20 from /api/products/new on demand,
 * appending rather than replacing so already-rendered cards (and their scroll position) never
 * jump. */
export function NewInGrid({
  initialProducts,
  initialHasMore,
}: {
  initialProducts: ProductDisplay[];
  initialHasMore: boolean;
}) {
  const [products, setProducts] = useState(initialProducts);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function loadMore() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/products/new?skip=${products.length}`);
        if (!res.ok) throw new Error("request failed");
        const data: { products: ProductDisplay[]; hasMore: boolean } = await res.json();
        setProducts((prev) => [...prev, ...data.products]);
        setHasMore(data.hasMore);
      } catch {
        setError("Couldn't load more right now — try again.");
      }
    });
  }

  return (
    <div>
      <div className="grid grid-cols-2 desktop:grid-cols-4 gap-5">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
      {hasMore ? (
        <div className="mt-7 flex flex-col items-center gap-2">
          <Button variant="ghost" onClick={loadMore} loading={pending}>
            Load more
          </Button>
          {error && <p className="text-[13px] text-error">{error}</p>}
        </div>
      ) : (
        <EndOfProducts />
      )}
    </div>
  );
}
