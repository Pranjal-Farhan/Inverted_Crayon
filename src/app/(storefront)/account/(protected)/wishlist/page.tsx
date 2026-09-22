import { getCustomerSession } from "@/lib/session";
import { db } from "@/lib/db";
import { deriveProductDisplay } from "@/lib/product-view";
import { ProductCard } from "@/components/ui/ProductCard";

export default async function AccountWishlistPage() {
  const session = await getCustomerSession();
  const now = new Date();

  const [items, campaigns] = await Promise.all([
    db.wishlistItem.findMany({
      where: { customerId: session!.customerId },
      include: {
        product: { include: { variants: true, images: true, tags: { include: { tag: true } }, category: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.campaign.findMany({ where: { active: true, startsAt: { lte: now }, endsAt: { gte: now } } }),
  ]);

  if (items.length === 0) {
    return <p className="text-muted">Nothing saved yet — tap the heart on a product to add it here.</p>;
  }

  return (
    <div className="grid grid-cols-2 desktop:grid-cols-3 gap-5">
      {items.map((item) => (
        <ProductCard key={item.id} product={deriveProductDisplay(item.product, campaigns, now)} />
      ))}
    </div>
  );
}
