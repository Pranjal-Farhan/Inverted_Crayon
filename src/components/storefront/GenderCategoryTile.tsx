"use client";

import Image from "next/image";
import Link from "next/link";
import { PlaceholderFrame } from "@/components/ui/PlaceholderFrame";
import { HandDrawnMark, pickMark, useMarkHover } from "@/components/brand/HandDrawnMarks";
import { pickAccent } from "@/lib/accent-color";

/**
 * A single subcategory tile on /men and /women (GenderHub.tsx) — same "circle this" hover/touch
 * mark as CategoryExplorer's CategoryCard, now also here so the gender hub pages get the same
 * drawn-mark treatment as the homepage drill-down. Split out as its own client component since
 * GenderHub itself is an async server component and the mark needs hover/touch state.
 */
export function GenderCategoryTile({
  href,
  name,
  imageUrl,
  accentSeed,
}: {
  href: string;
  name: string;
  imageUrl: string | null;
  accentSeed: string;
}) {
  const accent = pickAccent(accentSeed);
  const hoverColor = pickMark(`${accentSeed}-hover`, accent.color).color;
  const { hovered, handlers } = useMarkHover<HTMLAnchorElement>();

  return (
    <div className="relative">
      <Link
        href={href}
        prefetch={false}
        {...handlers}
        className="relative flex aspect-[1/1.2] items-end overflow-hidden border border-line bg-ink"
      >
        {imageUrl ? (
          <>
            <Image
              src={imageUrl}
              alt=""
              fill
              sizes="(min-width: 1024px) 25vw, 50vw"
              quality={90}
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 z-[2] h-1/2 bg-gradient-to-t from-ink/80 to-transparent" />
          </>
        ) : (
          <PlaceholderFrame accentColor={accent.color} shape={accent.shape} stamp={false} className="absolute inset-0 h-full w-full opacity-70" />
        )}
        <span className="relative z-[3] p-3 font-label text-lg tracking-[1.4px]">{name}</span>
      </Link>
      {/* Mark lives as a sibling of the (overflow-hidden) Link, not a child, so it can bleed past
          the tile's edge instead of being clipped — same pattern as CategoryExplorer's marks. */}
      <HandDrawnMark
        id={`genhub-${accentSeed}-hover`}
        kind="circle-loop"
        color={hoverColor}
        duration={500}
        visible={hovered}
        className="pointer-events-none absolute left-1/2 top-1/2 z-[6] h-[160%] w-[160%] -translate-x-1/2 -translate-y-1/2 rotate-90"
      />
    </div>
  );
}
