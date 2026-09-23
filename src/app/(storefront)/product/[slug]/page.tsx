import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getProductForPDP } from "@/lib/get-product";
import { TagPill } from "@/components/ui/TagPill";
import { Accordion } from "@/components/ui/Accordion";
import { AddToCartForm } from "@/components/storefront/AddToCartForm";
import { ProductCard } from "@/components/ui/ProductCard";
import { ProductGallery } from "@/components/storefront/ProductGallery";
import { ReviewList } from "@/components/storefront/ReviewList";
import { TrackRecentlyViewed, RecentlyViewedRail } from "@/components/storefront/RecentlyViewed";
import { formatTaka } from "@/lib/money";
import { toNumber } from "@/lib/money";
import { pickAccent } from "@/lib/accent-color";
import { Crown } from "@/components/brand/Crown";
import { WishlistButton } from "@/components/storefront/WishlistButton";
import { getCustomerSession } from "@/lib/session";
import { db } from "@/lib/db";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await getProductForPDP(slug);
  if (!data) return {};
  return { title: data.product.seoTitle ?? data.product.title, description: data.product.seoDescription ?? undefined };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const data = await getProductForPDP(slug);
  if (!data) notFound();
  const { product, display, related } = data;

  const session = await getCustomerSession();
  const wishlisted = session
    ? Boolean(
        await db.wishlistItem.findUnique({
          where: { customerId_productId: { customerId: session.customerId, productId: product.id } },
        }),
      )
    : false;

  const accent = pickAccent(product.id);
  const genderLabel = product.gender === "MEN" ? "Men" : product.gender === "WOMEN" ? "Women" : "Unisex";
  const genderPath = product.gender === "WOMEN" ? "women" : "men";

  const variantOptions = product.variants.map((v) => ({
    id: v.id,
    size: v.size,
    color: v.color,
    colorHex: v.colorHex,
    stockQty: v.stockQty,
    price: v.priceOverride != null ? toNumber(v.priceOverride) : display.basePrice,
  }));

  const avgRating =
    product.reviews.length > 0
      ? product.reviews.reduce((s, r) => s + r.rating, 0) / product.reviews.length
      : null;

  return (
    <section className="pg pb-16">
      <TrackRecentlyViewed productId={product.id} />
      <div className="grid gap-10 py-5.5 desktop:grid-cols-[1.05fr_1fr]">
        <ProductGallery
          images={product.images.map((img) => ({ id: img.id, accentColor: img.accentColor, alt: img.alt }))}
          fallbackAccent={accent}
          soldOut={display.soldOut}
        />

        <div className="min-w-0">
          <div className="font-label text-sm tracking-[1.4px] text-muted">
            <Link href={`/${genderPath}`}>{genderLabel}</Link> / {product.category.name} / {product.title}
          </div>

          <div className="statebar my-3 flex gap-2">
            <span className={`px-2.5 py-1 font-label text-[13px] tracking-[1px] ${!display.soldOut && !display.isPreorder ? "bg-white text-ink" : "bg-panel-2 text-muted"}`}>
              IN STOCK
            </span>
            <span className={`px-2.5 py-1 font-label text-[13px] tracking-[1px] ${display.isPreorder ? "bg-white text-ink" : "bg-panel-2 text-muted"}`}>
              PREORDER
            </span>
            <span className={`px-2.5 py-1 font-label text-[13px] tracking-[1px] ${display.soldOut ? "bg-white text-ink" : "bg-panel-2 text-muted"}`}>
              SOLD OUT
            </span>
          </div>

          <h1 className="font-impact text-[clamp(30px,4.4vw,46px)] uppercase leading-[0.9]">{product.title}</h1>

          {avgRating != null && (
            <div className="font-scrawl text-lg text-yellow">
              {"★".repeat(Math.round(avgRating))}
              {"☆".repeat(5 - Math.round(avgRating))}{" "}
              <small className="font-body text-xs text-muted">
                {avgRating.toFixed(1)} · {product.reviews.length} reviews
              </small>
            </div>
          )}

          <div className="price my-1.5 text-[30px]">
            {display.onSale && display.salePrice != null ? (
              <>
                <span className="mr-2 text-[20px] text-muted-2 line-through">{formatTaka(display.basePrice)}</span>
                <span className="text-yellow">{formatTaka(display.salePrice)}</span>
              </>
            ) : (
              formatTaka(display.basePrice)
            )}
          </div>

          {display.isPreorder && (
            <div className="mb-4 flex items-center gap-2.5 border border-dashed border-yellow bg-yellow/[0.07] px-3.5 py-2.5 text-sm">
              <Crown className="h-[22px] w-6 text-yellow" />
              Preorder — ships {display.preorderShipDate ?? "TBA"}. Yours before it drops.
            </div>
          )}

          <p className="mb-5.5 max-w-[46ch] text-[#cfcfce]">{product.description}</p>

          <div className="mb-3 flex flex-wrap gap-1.5">
            {display.isLimited && <TagPill kind="limited" />}
            {display.isBestseller && <TagPill kind="bestseller" />}
            {display.isNew && <TagPill kind="new" />}
          </div>

          <AddToCartForm
            productId={product.id}
            slug={product.slug}
            title={product.title}
            variants={variantOptions}
            isPreorder={display.isPreorder}
            preorderShipDate={display.preorderShipDate}
            accentColor={accent.color}
          />

          <div className="mt-5 mb-1 flex items-center justify-between">
            <p className="font-label text-sm text-cyan">
              <Link href="/size-guide">Size guide →</Link>
            </p>
            <WishlistButton productId={product.id} initialSaved={wishlisted} loggedIn={Boolean(session)} />
          </div>

          <div className="my-5 flex items-center gap-2 font-scrawl text-[15px] text-pink">
            <Crown className="h-6 w-6" /> Made to stand out.
          </div>

          <Accordion
            items={[
              { title: "Details", body: "260gsm combed cotton · oversized fit · ribbed collar · unisex." },
              { title: "Shipping", body: "Worldwide delivery. Dispatched in 24–48h from Dhaka." },
              { title: "Returns", body: "14-day easy returns, no drama." },
            ]}
          />
        </div>
      </div>

      {related.length > 0 && (
        <>
          <div className="sh my-8 flex items-center gap-3 font-scrawl text-[30px]">
            Complete the look <Crown className="h-6 w-[34px] text-lime" />
          </div>
          <div className="grid grid-cols-2 desktop:grid-cols-4 gap-5">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </>
      )}

      <RecentlyViewedRail excludeProductId={product.id} />

      <div className="sh my-8 flex items-center gap-3 font-scrawl text-[30px]">
        Reviews <Crown className="h-6 w-[34px] text-yellow" />
      </div>
      <div className="max-w-[640px]">
        <ReviewList reviews={product.reviews} />
        {session && (
          <p className="mt-3 text-[13px] text-muted">
            Bought this? <Link href="/account/orders" className="text-cyan">Write a review</Link> from your order history.
          </p>
        )}
      </div>
    </section>
  );
}
