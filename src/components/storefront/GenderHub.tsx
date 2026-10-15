import Image from "next/image";
import { getContentBlock, getGenderCategories, getGenderHubProducts } from "@/lib/public-cache";
import { deriveProductDisplay } from "@/lib/product-view";
import { PlaceholderFrame } from "@/components/ui/PlaceholderFrame";
import { ProductCard } from "@/components/ui/ProductCard";
import { Button } from "@/components/ui/Button";
import { GenderCategoryTile } from "@/components/storefront/GenderCategoryTile";
import { CrayonScribble } from "@/components/brand/CrayonScribble";
import { DEFAULT_GENDER_HERO, type GenderHeroData } from "@/lib/gender-hero-defaults";

export async function GenderHub({ gender }: { gender: "MEN" | "WOMEN" }) {
  const path = gender === "MEN" ? "men" : "women";
  const label = gender === "MEN" ? "Men" : "Women";

  const [products, categories, heroBlock] = await Promise.all([
    getGenderHubProducts(gender),
    getGenderCategories(gender),
    getContentBlock(gender === "MEN" ? "men_hero" : "women_hero"),
  ]);
  const display = products.map((p) => deriveProductDisplay(p));
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
          <Image src={hero.imageUrl} alt="" fill sizes="100vw" quality={90} className="object-cover" />
        ) : (
          <PlaceholderFrame accentColor="#ff2d84" shape="x" label={`${label.toUpperCase()} · EDITORIAL HERO`} className="h-full w-full" />
        )}
        {categories[0] && (
          <Button href={`/${path}/${categories[0].slug}`} prefetch={false} className="absolute bottom-5 left-5">
            Shop {label}
          </Button>
        )}
      </div>

      {categories.length > 0 ? (
        <div className="grid grid-cols-2 items-start desktop:grid-cols-4 gap-3.5">
          {categories.map((c) => (
            <GenderCategoryTile
              key={c.slug}
              href={`/${path}/${c.slug}`}
              name={c.name}
              imageUrl={c.imageUrl}
              accentSeed={`${path}-${c.slug}`}
            />
          ))}
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
