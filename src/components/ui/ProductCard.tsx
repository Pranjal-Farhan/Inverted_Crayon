"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { PlaceholderFrame } from "@/components/ui/PlaceholderFrame";
import { TagPill } from "@/components/ui/TagPill";
import { formatTaka } from "@/lib/money";
import { pickAccent } from "@/lib/accent-color";
import { DiscountPriceTag } from "@/components/brand/DiscountPriceTag";
import { HandDrawnMark, pickMark, useMarkHover } from "@/components/brand/HandDrawnMarks";
import type { ProductDisplay } from "@/lib/product-view";

/** Product card — one component, every surface (§05). */
export function ProductCard({ product }: { product: ProductDisplay }) {
  const accent = pickAccent(product.id);
  const hoverColor = pickMark(product.id, accent.color).color;
  const href = `/product/${product.slug}`;
  const primaryImage = product.images.find((img) => img.url)?.url;

  const cardRef = useRef<HTMLAnchorElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  // Mouse/focus for desktop, touch for phones — same hover-driven circle mark either way
  // (see useMarkHover's doc comment in HandDrawnMarks.tsx).
  const { hovered, handlers } = useMarkHover<HTMLAnchorElement>();
  // Visible by default — matches the server-rendered markup and keeps the card usable with
  // no JS. The effect below only hides it, briefly, if it's below the fold at mount time.
  const [revealed, setRevealed] = useState(true);

  useEffect(() => {
    const el = cardRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const rect = el.getBoundingClientRect();
    const alreadyOnScreen = rect.top < window.innerHeight && rect.bottom > 0;
    if (alreadyOnScreen) return;
    setRevealed(false);
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setRevealed(true);
            observer.disconnect();
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  function onFrameMove(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "mouse") return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = frameRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(600px) rotateX(${py * -8}deg) rotateY(${px * 8}deg)`;
  }
  function onFrameLeave() {
    if (frameRef.current) frameRef.current.style.transform = "";
  }

  const soldOutButPreorderable = product.soldOut && product.hasPreorderableVariant;
  const primaryTag = product.soldOut && !soldOutButPreorderable
    ? "soldout"
    : product.isPreorder || soldOutButPreorderable
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
    <Link
      ref={cardRef}
      href={href}
      className={`card group block reveal-card ${revealed ? "in" : ""}`}
      {...handlers}
    >
      {/* This outer wrapper (not the frame below) carries the aspect ratio and has no
          overflow-hidden, so the hover/touch circle mark — a sibling of the frame, not a child —
          can bleed slightly past the photo's edge instead of being clipped by the frame's own
          overflow-hidden (needed for the image crop + hover zoom). Keeping the mark scoped to
          this wrapper, rather than the whole card (image + caption text below), is what keeps it
          centered on the photo instead of sitting low over the caption too. */}
      <div className="relative mb-2.5 aspect-[1/1.16]">
        <div
          ref={frameRef}
          onPointerMove={onFrameMove}
          onPointerLeave={onFrameLeave}
          style={{ transformStyle: "preserve-3d", transition: "transform .15s ease-out" }}
          className="relative h-full w-full overflow-hidden"
        >
          {primaryImage ? (
            <>
              <Image
                src={primaryImage}
                alt={product.title}
                fill
                sizes="(min-width: 1024px) 25vw, 50vw"
                quality={90}
                className={`absolute inset-0 h-full w-full object-cover transition duration-300 ease-out ${!product.soldOut
                    ? "group-hover:scale-[1.05] group-hover:outline group-hover:outline-2 group-hover:outline-offset-[-2px] group-hover:outline-lime"
                    : ""
                  }`}
              />
              {product.soldOut && (
                <div className="absolute inset-0 z-[5] grid place-items-center bg-[rgba(8,8,9,.55)]">
                  <span className="font-impact text-[22px] tracking-[2px] text-paper">
                    {soldOutButPreorderable ? "PREORDER" : "SOLD OUT"}
                  </span>
                </div>
              )}
            </>
          ) : (
            <PlaceholderFrame
              accentColor={accent.color}
              shape={accent.shape}
              label={product.title.toUpperCase()}
              soldOut={product.soldOut}
              soldOutLabel={soldOutButPreorderable ? "PREORDER" : "SOLD OUT"}
              className={`absolute inset-0 h-full w-full transition duration-300 ease-out ${!product.soldOut
                  ? "group-hover:scale-[1.05] group-hover:outline group-hover:outline-2 group-hover:outline-offset-[-2px] group-hover:outline-lime"
                  : ""
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
              {soldOutButPreorderable ? "Preorder →" : "Notify me →"}
            </span>
          )}
        </div>
        {/* Hover/focus/touch "circle this" mark — rotated 90° so the mark's native landscape oval
            reorients to the frame's own aspect instead of being non-uniformly stretched into it
            (same convention as CategoryExplorer's CategoryCard/ProductTile marks). */}
        <HandDrawnMark
          id={`prodcard-${product.id}-hover`}
          kind="circle-loop"
          color={hoverColor}
          duration={500}
          visible={hovered}
          className="pointer-events-none absolute left-1/2 top-1/2 z-[7] h-[160%] w-[160%] -translate-x-1/2 -translate-y-1/2 rotate-90"
        />
      </div>
      <div className="font-label text-[11px] tracking-[1px] text-muted">{product.categoryName}</div>
      <h4 className="text-[14px] font-medium">{product.title}</h4>
      <div className="price mt-[3px] text-[15px] text-lime">
        {product.onSale && product.salePrice != null ? (
          <DiscountPriceTag id={product.id} basePrice={product.basePrice} salePrice={product.salePrice} size="sm" />
        ) : (
          formatTaka(product.basePrice)
        )}
      </div>
    </Link>
  );
}
