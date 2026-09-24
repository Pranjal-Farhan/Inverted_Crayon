"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type PointerEvent } from "react";
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

  const cardRef = useRef<HTMLAnchorElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
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
    <Link ref={cardRef} href={href} className={`card group block reveal-card ${revealed ? "in" : ""}`}>
      <div
        ref={frameRef}
        onPointerMove={onFrameMove}
        onPointerLeave={onFrameLeave}
        style={{ transformStyle: "preserve-3d", transition: "transform .15s ease-out" }}
        className="relative mb-2.5 aspect-[1/1.16] overflow-hidden"
      >
        {primaryImage ? (
          <>
            <img
              src={primaryImage}
              alt={product.title}
              className={`absolute inset-0 h-full w-full object-cover transition duration-300 ease-out ${
                !product.soldOut
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
            className={`absolute inset-0 h-full w-full transition duration-300 ease-out ${
              !product.soldOut
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
