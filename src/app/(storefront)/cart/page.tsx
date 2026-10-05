import type { Metadata } from "next";
import { getActiveCampaigns, getCartRecommendations } from "@/lib/public-cache";
import { deriveProductDisplay } from "@/lib/product-view";
import { CartPageView } from "@/components/storefront/CartPageView";
import { ProductCard } from "@/components/ui/ProductCard";

export const metadata: Metadata = { title: "Your Bag" };
// The bag's own contents are 100% client-side (localStorage via cart-context.tsx) — this page
// has no session/cookie read, only the cached "you might also like" query below, so it's
// static/ISR too.
export const revalidate = 3600;

export default async function CartPage() {
  const now = new Date();
  const [products, campaigns] = await Promise.all([getCartRecommendations(), getActiveCampaigns()]);
  const recs = products.map((p) => deriveProductDisplay(p, campaigns, now));

  return (
    <>
      <CartPageView />
      <div className="sh my-8 font-scrawl text-[30px]">You might also like</div>
      <div className="grid grid-cols-2 desktop:grid-cols-4 gap-5 pb-16">
        {recs.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </>
  );
}
