import Image from "next/image";
import Link from "next/link";
import { getActiveCampaigns, getContentBlock, getGenderCategories, getGenderHubProducts } from "@/lib/public-cache";
import { deriveProductDisplay } from "@/lib/product-view";
import { PlaceholderFrame } from "@/components/ui/PlaceholderFrame";
import { ProductCard } from "@/components/ui/ProductCard";
import { Button } from "@/components/ui/Button";
import { pickAccent } from "@/lib/accent-color";
import { CrayonScribble } from "@/components/brand/CrayonScribble";
import { DEFAULT_GENDER_HERO, type GenderHeroData } from "@/lib/gender-hero-defaults";

export async function GenderHub({ gender }: { gender: "MEN" | "WOMEN" }) {
  const path = gender === "MEN" ? "men" : "women";
  const label = gender === "MEN" ? "Men" : "Women";
  const now = new Date();

  const [products, campaigns, categories, heroBlock] = await Promise.all([
    getGenderHubProducts(gender),
    getActiveCampaigns(),
    getGenderCategories(gender),
    getContentBlock(gender === "MEN" ? "men_hero" : "women_hero"),
  ]);
  const display = products.map((p) => deriveProductDisplay(p, campaigns, now));
  const hero: GenderHeroData = { ...DEFAULT_GENDER_HERO, ...(heroBlock?.data as Partial<GenderHeroData> | undefined) };

  return (
    <section className="pg pb-16">
      <div className="pagehead relative pb-1.5">
        <span className="font-scrawl text-[15px] text-pink">The {label.toLowerCase()}&apos;s floor</span>
        <h1 className="font-impact text-[clamp(40px,6vw,72px)] uppercase leading-[0.85] tracking-[1px]">{label}</h1>
        <p className="mt-3 max-w-[52ch] text-muted">Zero rules. Pick your fit.</p>
        <CrayonScribble
          id={`gender-hub-${gender}`}
          color={gender === "MEN" ? "var(--color-ic-cyan)" : "var(--color-ic-pink)"}
          className="pointer-events-none absolute -top-3 right-2 hidden h-16 w-24 rotate-6 opacity-80 desktop:block"
        />
      </div>

      <div className="relative my-4.5 aspect-[5/1.4]">
        {hero.imageUrl ? (
          <Image src={hero.imageUrl} alt="" fill sizes="100vw" className="object-cover" />
        ) : (
          <PlaceholderFrame accentColor="#ff2d84" shape="x" label={`${label.toUpperCase()} · EDITORIAL HERO`} className="h-full w-full" />
        )}
        {categories[0] && (
          <Button href={`/${path}/${categories[0].slug}`} className="absolute bottom-5 left-5">
            Shop {label}
          </Button>
        )}
      </div>

      {categories.length > 0 ? (
        <div className="grid grid-cols-2 items-start desktop:grid-cols-4 gap-3.5">
          {categories.map((c) => {
            const accent = pickAccent(`${path}-${c.slug}`);
            return (
              <Link
                key={c.slug}
                href={`/${path}/${c.slug}`}
                className="relative flex aspect-[1/1.2] items-end overflow-hidden border border-line bg-ink"
              >
                {c.imageUrl ? (
                  <>
                    <Image src={c.imageUrl} alt="" fill sizes="(min-width: 1024px) 25vw, 50vw" className="absolute inset-0 h-full w-full object-cover" />
                    <div className="absolute inset-x-0 bottom-0 z-[2] h-1/2 bg-gradient-to-t from-ink/80 to-transparent" />
                  </>
                ) : (
                  <PlaceholderFrame accentColor={accent.color} shape={accent.shape} stamp={false} className="absolute inset-0 h-full w-full opacity-70" />
                )}
                <span className="relative z-[3] p-3 font-label text-lg tracking-[1.4px]">{c.name}</span>
              </Link>
            );
          })}
        </div>
      ) : (
        <p className="text-muted">No categories yet — add some from the admin panel.</p>
      )}

      <div className="sh my-8 font-scrawl text-[30px]">All Products {label}</div>
      <div className="grid grid-cols-2 desktop:grid-cols-4 gap-5">
        {display.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}
