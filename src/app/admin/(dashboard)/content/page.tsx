import { db } from "@/lib/db";
import { ContentCmsView } from "@/components/admin/ContentCmsView";
import { DEFAULT_HERO, type HeroData } from "@/lib/hero-defaults";
import { DEFAULT_GENDER_HERO, type GenderHeroData } from "@/lib/gender-hero-defaults";

export default async function AdminContentPage() {
  const [heroBlock, featuredBlock, menHeroBlock, womenHeroBlock, products] = await Promise.all([
    db.contentBlock.findUnique({ where: { key: "home_hero" } }),
    db.contentBlock.findUnique({ where: { key: "home_featured_drop" } }),
    db.contentBlock.findUnique({ where: { key: "men_hero" } }),
    db.contentBlock.findUnique({ where: { key: "women_hero" } }),
    db.product.findMany({ where: { status: "ACTIVE" }, select: { id: true, title: true }, orderBy: { title: "asc" } }),
  ]);

  const hero: HeroData = { ...DEFAULT_HERO, ...(heroBlock?.data as Partial<HeroData> | undefined) };
  const featuredProductId = (featuredBlock?.data as { productId?: string } | undefined)?.productId ?? null;
  const menHero: GenderHeroData = { ...DEFAULT_GENDER_HERO, ...(menHeroBlock?.data as Partial<GenderHeroData> | undefined) };
  const womenHero: GenderHeroData = { ...DEFAULT_GENDER_HERO, ...(womenHeroBlock?.data as Partial<GenderHeroData> | undefined) };

  return (
    <ContentCmsView
      hero={hero}
      featuredProductId={featuredProductId}
      products={products}
      menHero={menHero}
      womenHero={womenHero}
    />
  );
}
