import Link from "next/link";
import { PlaceholderFrame } from "@/components/ui/PlaceholderFrame";
import { TagPill } from "@/components/ui/TagPill";
import { formatTaka } from "@/lib/money";
import { pickAccent } from "@/lib/accent-color";
import type { ProductDisplay } from "@/lib/product-view";

/** Product card — one component, every surface (§05). */
export function ProductCard({ product }: { product: ProductDisplay }) {
  const accent = pickAccent(product.id);
  const href = `/product/${product.slug}`;
  const primaryImage = product.images.find((img) => img.url)?.url;

  const primaryTag = product.soldOut
    ? "soldout"
    : product.isPreorder
      ? "preorder"
      : product.onSale
        ? "sale"
        : product.isNew
          ? "new"
          : product.isLimited
            ? "limited"
            : product.isBestseller
              ? "bestseller"
              : null;

  return (
    <Link href={href} className="card group block">
      <div className="relative mb-2.5 aspect-[1/1.16]">
        {primaryImage ? (
          <>
            <img
              src={primaryImage}
              alt={product.title}
              className={`absolute inset-0 h-full w-full object-cover transition ${
                !product.soldOut ? "group-hover:outline group-hover:outline-2 group-hover:outline-offset-[-2px] group-hover:outline-lime" : ""
              }`}
            />
            {product.soldOut && (
              <div className="absolute inset-0 z-[5] grid place-items-center bg-[rgba(8,8,9,.55)]">
                <span className="font-impact text-[22px] tracking-[2px] text-paper">SOLD OUT</span>
              </div>
            )}
          </>
        ) : (
          <PlaceholderFrame
            accentColor={accent.color}
            shape={accent.shape}
            label={product.title.toUpperCase()}
            soldOut={product.soldOut}
            className={`absolute inset-0 h-full w-full transition ${
              !product.soldOut ? "group-hover:outline group-hover:outline-2 group-hover:outline-offset-[-2px] group-hover:outline-lime" : ""
            }`}
          />
        )}
        {primaryTag && (
          <span className="absolute left-2 top-2 z-[4] -rotate-2">
            <TagPill kind={primaryTag} />
          </span>
        )}
        {product.soldOut && (
          <span className="absolute inset-x-0 bottom-3 z-[6] hidden text-center font-label text-xs tracking-[1px] text-paper group-hover:block">
            Notify me →
          </span>
        )}
      </div>
      <h4 className="text-[14px] font-medium">{product.title}</h4>
      <div className="price mt-[3px] text-[15px] text-lime">
        {product.onSale && product.salePrice != null ? (
          <>
            <span className="mr-1.5 text-[13px] text-muted-2 line-through">{formatTaka(product.basePrice)}</span>
            <span className="text-yellow">{formatTaka(product.salePrice)}</span>
          </>
        ) : (
          formatTaka(product.basePrice)
        )}
      </div>
    </Link>
  );
}
