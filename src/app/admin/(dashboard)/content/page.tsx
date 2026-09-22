import { db } from "@/lib/db";
import { ContentCmsView } from "@/components/admin/ContentCmsView";

export default async function AdminContentPage() {
  const [heroBlock, featuredBlock, products] = await Promise.all([
    db.contentBlock.findUnique({ where: { key: "home_hero" } }),
    db.contentBlock.findUnique({ where: { key: "home_featured_drop" } }),
    db.product.findMany({ where: { status: "ACTIVE" }, select: { id: true, title: true }, orderBy: { title: "asc" } }),
  ]);

  const hero = (heroBlock?.data as {
    eyebrow: string;
    headline: string;
    sub: string;
    subBold: string;
    badge: string;
  } | undefined) ?? {
    eyebrow: "Color outside the norm.",
    headline: "Invert the ordinary.",
    sub: "Streetwear made for disruptors.",
    subBold: "Bold. Unfiltered. Inverted.",
    badge: "New drop live now",
  };
  const featuredProductId = (featuredBlock?.data as { productId?: string } | undefined)?.productId ?? null;

  return <ContentCmsView hero={hero} featuredProductId={featuredProductId} products={products} />;
}
