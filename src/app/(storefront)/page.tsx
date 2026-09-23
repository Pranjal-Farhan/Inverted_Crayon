import Link from "next/link";
import { db } from "@/lib/db";
import { deriveProductDisplay } from "@/lib/product-view";
import { PlaceholderFrame } from "@/components/ui/PlaceholderFrame";
import { ProductCard } from "@/components/ui/ProductCard";
import { Button } from "@/components/ui/Button";
import { Crown } from "@/components/brand/Crown";
import { pickAccent } from "@/lib/accent-color";
import { toNumber } from "@/lib/money";
import { AddToCartForm } from "@/components/storefront/AddToCartForm";

const COLLECTION_TILES = [
  { label: "Graphic Tees", href: "/men/tees", shape: "x" as const, color: "#ff2d84" },
  { label: "Hoodies", href: "/women/hoodies", shape: "square" as const, color: "#c3f53a" },
  { label: "Shirts", href: "/men/shirts", shape: "circle" as const, color: "#26a7e6" },
];

export default async function HomePage() {
  const now = new Date();
  const [heroBlock, featuredBlock, campaigns, newProductsRaw] = await Promise.all([
    db.contentBlock.findUnique({ where: { key: "home_hero" } }),
    db.contentBlock.findUnique({ where: { key: "home_featured_drop" } }),
    db.campaign.findMany({ where: { active: true, startsAt: { lte: now }, endsAt: { gte: now } } }),
    db.product.findMany({
      where: { status: "ACTIVE" },
      include: { variants: true, images: true, tags: { include: { tag: true } }, category: true },
      orderBy: { publishedAt: "desc" },
      take: 8,
    }),
  ]);

  const hero = (heroBlock?.data as
    | { eyebrow: string; headline: string; sub: string; subBold: string; badge: string }
    | undefined) ?? {
    eyebrow: "Color outside the norm.",
    headline: "Invert the ordinary.",
    sub: "Streetwear made for disruptors.",
    subBold: "Bold. Unfiltered. Inverted.",
    badge: "New drop live now",
  };

  const featuredId = (featuredBlock?.data as { productId?: string } | undefined)?.productId;
  const featuredProduct = featuredId
    ? await db.product.findUnique({
        where: { id: featuredId },
        include: { variants: true, images: true, tags: { include: { tag: true } }, category: true },
      })
    : newProductsRaw[0];

  const newProducts = newProductsRaw.map((p) => deriveProductDisplay(p, campaigns, now));
  const featuredDisplay = featuredProduct ? deriveProductDisplay(featuredProduct, campaigns, now) : null;
  const featuredAccent = featuredProduct ? pickAccent(featuredProduct.id) : null;

  return (
    <>
      {/* HERO */}
      <div className="grid grid-cols-1 gap-7 py-10 desktop:grid-cols-[1.05fr_1fr]">
        <div>
          <span className="font-scrawl flex items-center gap-2 text-[15px]">
            {hero.eyebrow} <Crown className="h-6 w-8 text-white" />
          </span>
          <h1 className="font-impact mt-3 text-[clamp(54px,7.5vw,110px)] uppercase leading-[0.82]">
            Invert the <span className="text-lime">ordinary.</span>
          </h1>
          <div className="my-5 h-[5px] w-[min(400px,78%)] -rotate-[0.6deg] bg-white" />
          <p className="mb-6.5 max-w-[32ch] text-[#dcdcda]">
            {hero.sub}
            <br />
            <b className="font-scrawl font-normal">{hero.subBold}</b>
          </p>
          <Button href="/new">Shop now</Button>
          <div className="mt-5.5 flex items-center gap-3 font-label text-lg tracking-[2px] text-muted-2">
            <span className="text-lime">01</span>
            <span className="h-0.5 w-10 bg-line-2" />
            02<span className="h-0.5 w-10 bg-line-2" />03
          </div>
        </div>
        <div className="relative">
          <div className="aspect-[3/3.3]">
            <PlaceholderFrame accentColor="#26a7e6" shape="circle" label="HERO · MODEL / BACK PRINT" className="h-full w-full" />
          </div>
          <div className="font-scrawl absolute right-[2%] top-[3%] z-[6] text-right text-lg">
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

      {/* COLLECTIONS */}
      <div className="sh my-8 flex items-center gap-3 font-scrawl text-[30px]">
        Collections <Crown className="h-6 w-[34px] text-cyan" />
      </div>
      <div className="grid grid-cols-1 gap-4 desktop:grid-cols-3">
        {COLLECTION_TILES.map((t) => (
          <Link key={t.label} href={t.href} className="relative flex min-h-[280px] items-end overflow-hidden border border-line bg-ink">
            <PlaceholderFrame accentColor={t.color} shape={t.shape} stamp={false} className="absolute inset-0 z-[2] h-full w-full" />
            <span className="font-scrawl relative z-[3] p-4.5 text-[26px]">{t.label}</span>
          </Link>
        ))}
      </div>

      {/* FEATURED DROP */}
      {featuredProduct && featuredDisplay && featuredAccent && (
        <>
          <div className="sh my-8 flex items-center gap-3 font-scrawl text-[30px]">
            Featured drop <Crown className="h-6 w-[34px] text-yellow" />
          </div>
          <div className="grid grid-cols-1 gap-8 desktop:grid-cols-[1fr_1.2fr] items-center border border-line bg-panel p-6">
            <div className="aspect-square">
              <PlaceholderFrame
                accentColor={featuredAccent.color}
                shape={featuredAccent.shape}
                label={featuredProduct.title.toUpperCase()}
                className="h-full w-full"
              />
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
      </div>
      <div className="grid grid-cols-2 desktop:grid-cols-4 gap-5 pb-16">
        {newProducts.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </>
  );
}
