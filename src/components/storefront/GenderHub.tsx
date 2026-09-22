import Link from "next/link";
import { db } from "@/lib/db";
import { deriveProductDisplay } from "@/lib/product-view";
import { PlaceholderFrame } from "@/components/ui/PlaceholderFrame";
import { ProductCard } from "@/components/ui/ProductCard";
import { Button } from "@/components/ui/Button";
import { CATEGORIES } from "@/lib/categories";
import { pickAccent } from "@/lib/accent-color";

export async function GenderHub({ gender }: { gender: "MEN" | "WOMEN" }) {
  const path = gender === "MEN" ? "men" : "women";
  const label = gender === "MEN" ? "Men" : "Women";
  const now = new Date();

  const [products, campaigns] = await Promise.all([
    db.product.findMany({
      where: { gender, status: "ACTIVE" },
      include: { variants: true, images: true, tags: { include: { tag: true } }, category: true },
      orderBy: { publishedAt: "desc" },
      take: 8,
    }),
    db.campaign.findMany({ where: { active: true, startsAt: { lte: now }, endsAt: { gte: now } } }),
  ]);
  const display = products.map((p) => deriveProductDisplay(p, campaigns, now));

  return (
    <section className="pg pb-16">
      <div className="pagehead pb-1.5">
        <span className="font-scrawl text-[15px] text-pink">The {label.toLowerCase()}&apos;s floor</span>
        <h1 className="font-impact text-[clamp(40px,6vw,72px)] uppercase leading-[0.85] tracking-[1px]">{label}</h1>
        <p className="mt-3 max-w-[52ch] text-muted">Eight categories, zero rules. Pick your fit.</p>
      </div>

      <div className="relative my-4.5 aspect-[5/1.4]">
        <PlaceholderFrame accentColor="#ff2d84" shape="x" label={`${label.toUpperCase()} · EDITORIAL HERO`} className="h-full w-full" />
        <Button href={`/${path}/${CATEGORIES[0].slug}`} className="absolute bottom-5 left-5">
          Shop {label}
        </Button>
      </div>

      <div className="grid grid-cols-2 items-start desktop:grid-cols-4 gap-3.5">
        {CATEGORIES.map((c, i) => {
          const accent = pickAccent(`${path}-${c.slug}`);
          void i;
          return (
            <Link
              key={c.slug}
              href={`/${path}/${c.slug}`}
              className="relative flex aspect-[1/1.2] items-end overflow-hidden border border-line bg-ink"
            >
              <PlaceholderFrame accentColor={accent.color} shape={accent.shape} stamp={false} className="absolute inset-0 h-full w-full opacity-70" />
              <span className="relative z-[3] p-3 font-label text-lg tracking-[1.4px]">{c.name}</span>
            </Link>
          );
        })}
      </div>

      <div className="sh my-8 font-scrawl text-[30px]">New in {label}</div>
      <div className="grid grid-cols-2 desktop:grid-cols-4 gap-5">
        {display.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </section>
  );
}
