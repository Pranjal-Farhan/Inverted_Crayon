import { db } from "@/lib/db";
import { ContentCmsView } from "@/components/admin/ContentCmsView";
import { DEFAULT_HERO, type HeroData } from "@/lib/hero-defaults";

export default async function AdminContentPage() {
  const [heroBlock, featuredBlock, products] = await Promise.all([
    db.contentBlock.findUnique({ where: { key: "home_hero" } }),
    db.contentBlock.findUnique({ where: { key: "home_featured_drop" } }),
    db.product.findMany({ where: { status: "ACTIVE" }, select: { id: true, title: true }, orderBy: { title: "asc" } }),
  ]);

  const hero: HeroData = { ...DEFAULT_HERO, ...(heroBlock?.data as Partial<HeroData> | undefined) };
  const featuredProductId = (featuredBlock?.data as { productId?: string } | undefined)?.productId ?? null;

  return <ContentCmsView hero={hero} featuredProductId={featuredProductId} products={products} />;
}
