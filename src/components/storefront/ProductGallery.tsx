"use client";

import { useRef, useState } from "react";
import { PlaceholderFrame } from "@/components/ui/PlaceholderFrame";
import { pickAccent } from "@/lib/accent-color";

type GalleryImage = { id: string; accentColor: string | null; alt: string | null };

export function ProductGallery({
  images,
  fallbackAccent,
  soldOut,
}: {
  images: GalleryImage[];
  fallbackAccent: { color: string; shape: "x" | "circle" | "square" };
  soldOut: boolean;
}) {
  const [active, setActive] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const slides = images.length > 0 ? images : [{ id: "fallback", accentColor: fallbackAccent.color, alt: null }];

  function go(delta: number) {
    setActive((i) => (i + delta + slides.length) % slides.length);
  }

  return (
    <div className="grid min-w-0 grid-cols-1 items-start gap-3 desktop:grid-cols-[70px_1fr]">
      <div className="hidden desktop:flex flex-col gap-2.5">
        {slides.map((img, i) => {
          const accent = pickAccent(img.id);
          return (
            <button
              key={img.id}
              onClick={() => setActive(i)}
              className={`aspect-square border ${active === i ? "border-lime" : "border-line"}`}
              aria-label={`View image ${i + 1}`}
            >
              <PlaceholderFrame accentColor={img.accentColor ?? accent.color} shape={accent.shape} stamp={false} className="h-full w-full" />
            </button>
          );
        })}
      </div>

      <div
        className="relative aspect-[1/1.14] touch-pan-y select-none"
        onTouchStart={(e) => {
          touchStartX.current = e.touches[0].clientX;
        }}
        onTouchEnd={(e) => {
          if (touchStartX.current == null) return;
          const delta = e.changedTouches[0].clientX - touchStartX.current;
          if (Math.abs(delta) > 40) go(delta < 0 ? 1 : -1);
          touchStartX.current = null;
        }}
      >
        {(() => {
          const img = slides[active];
          const accent = pickAccent(img.id);
          return (
            <PlaceholderFrame
              accentColor={img.accentColor ?? accent.color}
              shape={accent.shape}
              label="PRODUCT · FRONT"
              soldOut={soldOut}
              className="h-full w-full"
            />
          );
        })()}

        {slides.length > 1 && (
          <>
            <button
              onClick={() => go(-1)}
              aria-label="Previous image"
              className="absolute left-2 top-1/2 z-[6] -translate-y-1/2 rounded-full bg-ink/70 p-2 desktop:hidden"
            >
              <span className="font-impact text-lime">‹</span>
            </button>
            <button
              onClick={() => go(1)}
              aria-label="Next image"
              className="absolute right-2 top-1/2 z-[6] -translate-y-1/2 rounded-full bg-ink/70 p-2 desktop:hidden"
            >
              <span className="font-impact text-lime">›</span>
            </button>
            <div className="absolute bottom-2 left-1/2 z-[6] flex -translate-x-1/2 gap-1.5 desktop:hidden">
              {slides.map((s, i) => (
                <span key={s.id} className={`h-1.5 w-1.5 rounded-full ${i === active ? "bg-lime" : "bg-white/40"}`} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
