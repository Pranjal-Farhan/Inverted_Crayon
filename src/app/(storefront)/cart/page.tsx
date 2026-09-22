import type { Metadata } from "next";
import { db } from "@/lib/db";
import { deriveProductDisplay } from "@/lib/product-view";
import { CartPageView } from "@/components/storefront/CartPageView";
import { ProductCard } from "@/components/ui/ProductCard";

export const metadata: Metadata = { title: "Your Bag" };

export default async function CartPage() {
  const now = new Date();
  const [products, campaigns] = await Promise.all([
    db.product.findMany({
      where: { status: "ACTIVE" },
      include: { variants: true, images: true, tags: { include: { tag: true } }, category: true },
      orderBy: { publishedAt: "desc" },
      take: 4,
    }),
    db.campaign.findMany({ where: { active: true, startsAt: { lte: now }, endsAt: { gte: now } } }),
  ]);
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
