import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { deriveProductDisplay } from "@/lib/product-view";
import { PlaceholderFrame } from "@/components/ui/PlaceholderFrame";
import { ProductCard } from "@/components/ui/ProductCard";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const collection = await db.collection.findUnique({ where: { slug } });
  return { title: collection?.title ?? "Drop" };
}

export default async function DropPage({ params }: Props) {
  const { slug } = await params;
  const now = new Date();

  const [collection, campaigns] = await Promise.all([
    db.collection.findUnique({
      where: { slug },
      include: {
        products: {
          include: {
            product: { include: { variants: true, images: true, tags: { include: { tag: true } }, category: true } },
          },
        },
      },
    }),
    db.campaign.findMany({ where: { active: true, startsAt: { lte: now }, endsAt: { gte: now } } }),
  ]);
  if (!collection) notFound();

  const products = collection.products.map((pc) => deriveProductDisplay(pc.product, campaigns, now));

  return (
    <section className="pg pb-16">
      <div className="relative my-4.5 aspect-[5/1.7]">
        <PlaceholderFrame accentColor="#ff2d84" shape="square" label="DROP · EDITORIAL HERO" className="h-full w-full" />
        <div className="absolute bottom-6 left-6">
          <div className="font-scrawl text-[15px] text-pink">Drop</div>
          <div className="font-impact text-[44px] uppercase leading-[0.9]">{collection.title}</div>
        </div>
      </div>
      {collection.description && <p className="max-w-[620px] py-2 text-[#d3d3d1]">{collection.description}</p>}
      {collection.heroCopy && <p className="max-w-[620px] text-muted">{collection.heroCopy}</p>}

      <div className="mt-4.5 grid grid-cols-2 desktop:grid-cols-4 gap-5">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
        {products.length === 0 && <p className="text-muted">No products in this drop yet.</p>}
      </div>
    </section>
  );
}
