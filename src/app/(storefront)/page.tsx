import Link from "next/link";
import Image from "next/image";
import {
  getActiveCampaigns,
  getCachedProductById,
  getContentBlock,
  getHomeNewProducts,
  getSpotlightCategories,
} from "@/lib/public-cache";
import { deriveProductDisplay } from "@/lib/product-view";
import { PlaceholderFrame } from "@/components/ui/PlaceholderFrame";
import { ProductCard } from "@/components/ui/ProductCard";
import { Button } from "@/components/ui/Button";
import { Crown } from "@/components/brand/Crown";
import { pickAccent } from "@/lib/accent-color";
import { toNumber } from "@/lib/money";
import { AddToCartForm } from "@/components/storefront/AddToCartForm";
import { HeroCarousel } from "@/components/storefront/HeroCarousel";
import { ScrambleHeadline } from "@/components/storefront/ScrambleHeadline";
import { CrayonScribble } from "@/components/brand/CrayonScribble";
import { DEFAULT_HERO, type HeroData } from "@/lib/hero-defaults";

// 300s rather than the usual 3600s safety net: this page shows campaign-derived sale pricing
// (onSale/salePrice), and a campaign's startsAt/endsAt boundary passes with zero admin action —
// nothing calls revalidateTag at that exact moment, so only this timer catches it. Checkout
// still recomputes price fresh from the DB regardless (src/actions/checkout.ts), so the risk
// here is a stale *displayed* badge/price for up to 5 minutes, never an actual overcharge.
export const revalidate = 300;

/** "Pants" -> "Men's Pants" / "Women's Pants" — a Unisex category's name already reads fine alone. */
function categoryLabel(gender: "MEN" | "WOMEN" | "UNISEX", name: string): string {
  if (gender === "MEN") return `Men's ${name}`;
  if (gender === "WOMEN") return `Women's ${name}`;
  return name;
}

export default async function HomePage() {
  const now = new Date();
  const [heroBlock, featuredBlock, campaigns, newProductsRaw, spotlightCategories] = await Promise.all([
    getContentBlock("home_hero"),
    getContentBlock("home_featured_drop"),
    getActiveCampaigns(),
    getHomeNewProducts(),
    // Every category across every gender branch — same taxonomy the admin already manages from
    // /admin/categories (§5.1), so setting a tile image there is what drives this section.
    getSpotlightCategories(),
  ]);

  const hero: HeroData = { ...DEFAULT_HERO, ...(heroBlock?.data as Partial<HeroData> | undefined) };
  const [headlineFirst, ...headlineRest] = hero.headline.split(" ");
  const headlineRestText = headlineRest.join(" ");

  const featuredId = (featuredBlock?.data as { productId?: string } | undefined)?.productId;
  const featuredProduct = featuredId ? await getCachedProductById(featuredId) : newProductsRaw[0];

  const newProducts = newProductsRaw.map((p) => deriveProductDisplay(p, campaigns, now));
  const featuredDisplay = featuredProduct ? deriveProductDisplay(featuredProduct, campaigns, now) : null;
  const featuredAccent = featuredProduct ? pickAccent(featuredProduct.id) : null;
  const featuredImage = featuredProduct?.images.find((img) => img.url)?.url;

  return (
    <>
      {/* HERO */}
      <div
        className="grid grid-cols-1 gap-7 py-10 desktop:grid-cols-[1.05fr_1fr]"
        style={hero.backgroundColor ? { backgroundColor: hero.backgroundColor } : undefined}
      >
        <div className="relative">
          <span className="font-scrawl flex items-center gap-2 text-[15px]">
            {hero.eyebrow} <Crown className="h-6 w-8 text-white" />
          </span>
          <h1 className="font-impact mt-3 text-[clamp(54px,7.5vw,110px)] uppercase leading-[0.82]">
            <ScrambleHeadline first={headlineFirst} rest={headlineRestText} />
          </h1>
          <div className="my-5 h-[5px] w-[min(400px,78%)] -rotate-[0.6deg] bg-white" />
          <p className="mb-6.5 max-w-[32ch] text-[#dcdcda]">
            {hero.sub}
            <br />
            <b className="font-scrawl font-normal">{hero.subBold}</b>
          </p>
          <Button href="/new" className="text-ink">Shop now</Button>
          <div className="mt-5.5 flex items-center gap-3 font-label text-lg tracking-[2px] text-muted-2">
            <span className="text-lime">01</span>
            <span className="h-0.5 w-10 bg-line-2" />
            02<span className="h-0.5 w-10 bg-line-2" />03
          </div>
          <CrayonScribble
            id="hero"
            color="var(--color-ic-lime)"
            className="pointer-events-none absolute bottom-0 right-2 hidden h-20 w-28 -rotate-[8deg] opacity-90 desktop:block"
          />
        </div>
        <div className="relative">
          <div className="aspect-[3/3.3]">
            {hero.heroImages.length > 0 ? (
              <HeroCarousel images={hero.heroImages} />
            ) : (
              <PlaceholderFrame accentColor="#26a7e6" shape="circle" label="HERO · MODEL / BACK PRINT" className="h-full w-full" />
            )}
          </div>
          <div
            className="font-scrawl glitch-text absolute right-[2%] top-[3%] z-[6] text-right text-lg"
            data-text="Not NORMAL Never was."
          >
            Not <span className="relative text-[#cfcfcd] after:absolute after:-left-1 after:right-0 after:top-1/2 after:h-[3px] after:-rotate-[4deg] after:bg-pink after:content-['']">NORMAL</span>
            <br />
            <span className="text-yellow">Never</span> was.
          </div>
          <div className="font-scrawl absolute right-[-4px] top-[36%] z-[6] -rotate-[8deg] rounded-full border-2 border-white px-4 py-3 text-center text-[15px] leading-none">
            <span className="text-pink">{hero.badge.split(" ").slice(0, 2).join(" ")}</span>
            <br />
            {hero.badge.split(" ").slice(2).join(" ") || "Live now"}
          </div>
        </div>
      </div>

      {/* CATEGORY SPOTLIGHT */}
      <div className="sh my-8 flex items-center gap-3 font-scrawl text-[30px]">
        Shop by category <Crown className="h-6 w-[34px] text-cyan" />
        <CrayonScribble id="collections-h" color="var(--color-ic-cyan)" className="h-6 w-10 -rotate-3 opacity-80" />
      </div>
      <div className="grid grid-cols-1 gap-4 desktop:grid-cols-3">
        {spotlightCategories.map((c) => {
          const accent = pickAccent(`spotlight-${c.slug}`);
          return (
            <Link
              key={c.id}
              href={`/${c.gender.toLowerCase()}/${c.slug}`}
              prefetch={false}
              className="relative flex min-h-[280px] items-end overflow-hidden border border-line bg-ink"
            >
              {c.imageUrl ? (
                <>
                  <Image src={c.imageUrl} alt="" fill sizes="(min-width: 1024px) 33vw, 100vw" className="absolute inset-0 z-[2] h-full w-full object-cover" />
                  <div className="absolute inset-x-0 bottom-0 z-[2] h-1/2 bg-gradient-to-t from-ink/80 to-transparent" />
                </>
              ) : (
                <PlaceholderFrame accentColor={accent.color} shape={accent.shape} stamp={false} className="absolute inset-0 z-[2] h-full w-full" />
              )}
              <span className="font-scrawl relative z-[3] p-4.5 text-[26px]">{categoryLabel(c.gender, c.name)}</span>
            </Link>
          );
        })}
      </div>

      {/* FEATURED DROP */}
      {featuredProduct && featuredDisplay && featuredAccent && (
        <>
          <div className="sh my-8 flex items-center gap-3 font-scrawl text-[30px]">
            Featured drop <Crown className="h-6 w-[34px] text-yellow" />
            <CrayonScribble id="featured-h" color="var(--color-ic-yellow)" className="h-6 w-10 rotate-2 opacity-80" />
          </div>
          <div className="grid grid-cols-1 gap-8 desktop:grid-cols-[1fr_1.2fr] items-center border border-line bg-panel p-6">
            <div className="relative aspect-square">
              {featuredImage ? (
                <Image
                  src={featuredImage}
                  alt={featuredProduct.title}
                  fill
                  sizes="(min-width: 1024px) 45vw, 100vw"
                  className="object-cover"
                />
              ) : (
                <PlaceholderFrame
                  accentColor={featuredAccent.color}
                  shape={featuredAccent.shape}
                  label={featuredProduct.title.toUpperCase()}
                  className="h-full w-full"
                />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="font-impact text-3xl uppercase">{featuredProduct.title}</h3>
              <AddToCartForm
                productId={featuredProduct.id}
                slug={featuredProduct.slug}
                title={featuredProduct.title}
                variants={featuredProduct.variants.map((v) => ({
                  id: v.id,
                  size: v.size,
                  color: v.color,
                  colorHex: v.colorHex,
                  stockQty: v.stockQty,
                  price: v.priceOverride != null ? toNumber(v.priceOverride) : featuredDisplay.basePrice,
                  preorderAdvanceAmount: v.preorderAdvanceAmount != null ? toNumber(v.preorderAdvanceAmount) : null,
                }))}
                isPreorder={featuredDisplay.isPreorder}
                preorderShipDate={featuredDisplay.preorderShipDate}
                accentColor={featuredAccent.color}
              />
            </div>
          </div>
        </>
      )}

      {/* NEW IN */}
      <div className="sh my-8 flex items-center gap-3 font-scrawl text-[30px]">
        New In <Crown className="h-6 w-[34px] text-pink" />
        <CrayonScribble id="newin-h" color="var(--color-ic-pink)" className="h-6 w-10 -rotate-2 opacity-80" />
      </div>
      <div className="grid grid-cols-2 desktop:grid-cols-4 gap-5">
        {newProducts.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>

      {/* TRACK YOUR ORDER */}
      <div className="sh my-8 flex items-center gap-3 font-scrawl text-[30px]">
        Track your order <Crown className="h-6 w-[34px] text-lime" />
        <CrayonScribble id="track-h" color="var(--color-ic-lime)" className="h-6 w-10 rotate-2 opacity-80" />
      </div>
      <div className="mb-16 max-w-[520px] border border-line bg-panel p-6">
        <p className="mb-3.5 text-sm text-muted">
          Enter your order number to see what&apos;s in it and whether it&apos;s shipped yet — no account needed.
        </p>
        <form className="flex gap-2.5" action="/order-status" method="get">
          <input
            name="number"
            placeholder="Order number"
            className="flex-1 border border-line-2 bg-ink px-3 py-2.5 outline-none focus:border-lime"
          />
          <Button type="submit" size="sm">
            Track
          </Button>
        </form>
      </div>
    </>
  );
}
