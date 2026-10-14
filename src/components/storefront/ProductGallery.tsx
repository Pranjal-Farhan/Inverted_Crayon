"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type TouchEvent } from "react";
import { PlaceholderFrame } from "@/components/ui/PlaceholderFrame";
import { pickAccent } from "@/lib/accent-color";

type GalleryImage = { id: string; url?: string; accentColor: string | null; alt: string | null };

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
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const touchStartX = useRef<number | null>(null);
  // A swipe's touchend also fires a synthetic click right after — set when a swipe just
  // navigated so the following click doesn't also open the lightbox on the new slide.
  const suppressNextClick = useRef(false);
  const slides = images.length > 0 ? images : [{ id: "fallback", accentColor: fallbackAccent.color, alt: null }];

  function go(delta: number) {
    setActive((i) => (i + delta + slides.length) % slides.length);
  }

  function selectSlide(i: number) {
    setActive(i);
  }

  function openLightbox() {
    if (suppressNextClick.current) {
      suppressNextClick.current = false;
      return;
    }
    if (!slides[active]?.url) return;
    setLightboxOpen(true);
  }

  function handleTouchStart(e: TouchEvent<HTMLDivElement>) {
    touchStartX.current = e.touches[0].clientX;
  }

  function handleSwipeTouchEnd(e: TouchEvent<HTMLDivElement>) {
    if (touchStartX.current == null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) > 40) {
      go(delta < 0 ? 1 : -1);
      suppressNextClick.current = true;
    }
  }

  // Esc to close, arrow keys to navigate, and lock background scroll — all only while open.
  useEffect(() => {
    if (!lightboxOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLightboxOpen(false);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightboxOpen, slides.length]);

  const activeSlide = slides[active];
  const activeAccent = pickAccent(activeSlide.id);

  return (
    <div className="grid min-w-0 grid-cols-1 items-start gap-3 desktop:grid-cols-[70px_1fr]">
      <div className="hidden desktop:flex flex-col gap-2.5">
        {slides.map((img, i) => {
          const accent = pickAccent(img.id);
          return (
            <button
              key={img.id}
              onClick={() => selectSlide(i)}
              className={`relative aspect-square border ${active === i ? "border-lime" : "border-line"}`}
              aria-label={`View image ${i + 1}`}
            >
              {img.url ? (
                <Image src={img.url} alt={img.alt ?? ""} fill sizes="70px" quality={90} className="object-cover" />
              ) : (
                <PlaceholderFrame accentColor={img.accentColor ?? accent.color} shape={accent.shape} stamp={false} className="h-full w-full" />
              )}
            </button>
          );
        })}
      </div>

      <div>
        <div
          className={`relative aspect-square overflow-hidden touch-pan-y select-none ${activeSlide.url ? "cursor-zoom-in" : ""}`}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleSwipeTouchEnd}
          onClick={openLightbox}
        >
          {activeSlide.url ? (
            <>
              <Image
                src={activeSlide.url}
                alt={activeSlide.alt ?? ""}
                fill
                sizes="(min-width: 1024px) 50vw, 100vw"
                quality={90}
                className="object-contain"
              />
              {soldOut && (
                <div className="absolute inset-0 z-[5] grid place-items-center bg-[rgba(8,8,9,.55)]">
                  <span className="font-impact text-[22px] tracking-[2px] text-paper">SOLD OUT</span>
                </div>
              )}
            </>
          ) : (
            <PlaceholderFrame
              accentColor={activeSlide.accentColor ?? activeAccent.color}
              shape={activeAccent.shape}
              label="PRODUCT · FRONT"
              soldOut={soldOut}
              className="h-full w-full"
            />
          )}

          {slides.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  go(-1);
                }}
                aria-label="Previous image"
                className="absolute left-2 top-1/2 z-[6] -translate-y-1/2 rounded-full bg-ink/70 p-2 desktop:hidden"
              >
                <span className="font-impact text-lime">‹</span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  go(1);
                }}
                aria-label="Next image"
                className="absolute right-2 top-1/2 z-[6] -translate-y-1/2 rounded-full bg-ink/70 p-2 desktop:hidden"
              >
                <span className="font-impact text-lime">›</span>
              </button>
            </>
          )}
        </div>

        {/* Thumbnail filmstrip beneath the main image — desktop already gets the vertical
            strip to the left, this is the mobile equivalent (horizontal, under the photo). */}
        {slides.length > 1 && (
          <div className="mt-2.5 flex gap-2 overflow-x-auto desktop:hidden">
            {slides.map((img, i) => {
              const accent = pickAccent(img.id);
              return (
                <button
                  key={img.id}
                  onClick={() => selectSlide(i)}
                  className={`relative aspect-square h-14 w-14 shrink-0 border ${active === i ? "border-lime" : "border-line"}`}
                  aria-label={`View image ${i + 1}`}
                >
                  {img.url ? (
                    <Image src={img.url} alt={img.alt ?? ""} fill sizes="56px" quality={90} className="object-cover" />
                  ) : (
                    <PlaceholderFrame accentColor={img.accentColor ?? accent.color} shape={accent.shape} stamp={false} className="h-full w-full" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {lightboxOpen && activeSlide.url && (
        <div
          className="overlay-fade-in fixed inset-0 z-[260] flex flex-col bg-ink/97 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Image viewer"
        >
          <div className="flex justify-end p-3">
            <button
              onClick={() => setLightboxOpen(false)}
              aria-label="Close image viewer"
              className="text-3xl leading-none text-muted hover:text-paper"
            >
              ×
            </button>
          </div>

          <div className="relative flex-1" onTouchStart={handleTouchStart} onTouchEnd={handleSwipeTouchEnd}>
            <Image
              src={activeSlide.url}
              alt={activeSlide.alt ?? ""}
              fill
              sizes="100vw"
              quality={95}
              className="object-contain"
            />

            {slides.length > 1 && (
              <>
                <button
                  onClick={() => go(-1)}
                  aria-label="Previous image"
                  className="absolute left-2 top-1/2 z-[6] -translate-y-1/2 rounded-full bg-ink/70 p-3"
                >
                  <span className="font-impact text-[22px] text-lime">‹</span>
                </button>
                <button
                  onClick={() => go(1)}
                  aria-label="Next image"
                  className="absolute right-2 top-1/2 z-[6] -translate-y-1/2 rounded-full bg-ink/70 p-3"
                >
                  <span className="font-impact text-[22px] text-lime">›</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
