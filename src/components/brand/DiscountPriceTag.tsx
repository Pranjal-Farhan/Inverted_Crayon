import { HandDrawnMark } from "@/components/brand/HandDrawnMarks";
import { formatTaka } from "@/lib/money";

/**
 * A discounted price, wherever a product's price renders (ProductCard, PDP, ...) — the original
 * amount gets a single thin red crayon strike through it (HandDrawnMark's "strike" kind, drawn on
 * on mount like every other mark in this family), and the new price sits in plain/normal text on
 * its own small rough crayon patch, tucked over the old price's top-right corner, tilted -45°
 * and sitting slightly above it, roughly the same footprint as the new price text itself (the
 * patch is sized off its own content via absolute inset, not a fixed box, so it fits "৳850" and
 * "৳1,200" equally snugly).
 */
export function DiscountPriceTag({
  id,
  basePrice,
  salePrice,
  size = "md",
}: {
  /** Unique within the page — seeds the crayon texture filters, same convention as HandDrawnMark. */
  id: string;
  basePrice: number;
  salePrice: number;
  size?: "sm" | "md" | "lg";
}) {
  const oldSizeClass = size === "lg" ? "text-xl" : size === "sm" ? "text-[13px]" : "text-[15px]";
  const newSizeClass = size === "lg" ? "text-sm" : "text-[11px]";

  return (
    <span className="discount-tag relative inline-flex">
      <span className={`relative inline-block text-muted-2 ${oldSizeClass}`}>
        {formatTaka(basePrice)}
        <HandDrawnMark
          id={`${id}-strike`}
          kind="strike"
          color="#ff4d4d"
          duration={550}
          stretch
          className="pointer-events-none absolute -inset-x-[6%] inset-y-[15%] z-[2]"
        />
      </span>
      <span
        className={`discount-tag-badge absolute -right-2.5 -top-3.5 z-[3] whitespace-nowrap font-sans font-bold text-ink ${newSizeClass}`}
      >
        <CrayonPatch id={`${id}-patch`} className="absolute -inset-x-1.5 -inset-y-1 -z-10" />
        <span className="relative px-0.5">{formatTaka(salePrice)}</span>
      </span>
    </span>
  );
}

function CrayonPatch({ id, className }: { id: string; className?: string }) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const filterId = `patch-tex-${id}`;
  return (
    <svg viewBox="0 0 100 50" preserveAspectRatio="none" className={className} aria-hidden="true">
      <defs>
        <filter id={filterId} x="-30%" y="-30%" width="160%" height="160%">
          <feTurbulence type="fractalNoise" baseFrequency="0.1 0.22" numOctaves="2" seed={h % 97} result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="9" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
      <rect x="4" y="4" width="92" height="42" rx="4" fill="var(--color-ic-lime)" filter={`url(#${filterId})`} />
    </svg>
  );
}
