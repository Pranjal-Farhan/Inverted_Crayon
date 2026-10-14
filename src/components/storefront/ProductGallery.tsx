"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type MouseEvent, type PointerEvent, type TouchEvent } from "react";
import { PlaceholderFrame } from "@/components/ui/PlaceholderFrame";
import { pickAccent } from "@/lib/accent-color";

type GalleryImage = { id: string; url?: string; accentColor: string | null; alt: string | null };

// Below this horizontal finger movement, a touch is a tap (open the lightbox) rather than a
// swipe (navigate slides) — see handleTouchEnd.
const TAP_THRESHOLD_PX = 10;
const SWIPE_THRESHOLD_PX = 40;

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
  const [zoomed, setZoomed] = useState(false);
  const [zoomOrigin, setZoomOrigin] = useState({ x: 50, y: 50 });
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const slides = images.length > 0 ? images : [{ id: "fallback", accentColor: fallbackAccent.color, alt: null }];

  function go(delta: number) {
    setActive((i) => (i + delta + slides.length) % slides.length);
    setZoomed(false);
  }

  function selectSlide(i: number) {
    setActive(i);
    setZoomed(false);
  }

  function openLightbox() {
    if (!slides[active]?.url) return;
    setLightboxOpen(true);
  }

  // Click to toggle zoom (mouse only — touch keeps the swipe/tap gesture below). Once zoomed,
  // moving the pointer pans the magnified view by re-anchoring the scale's origin to the
  // cursor position, so the zoomed image navigates with the mouse rather than sitting pinned
  // at the click point.
  function toggleZoom(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "mouse") return;
    if (!slides[active]?.url) return;
    setZoomed((z) => !z);
  }

  function panZoom(e: MouseEvent<HTMLDivElement>) {
    if (!zoomed) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    setZoomOrigin({ x: Math.min(100, Math.max(0, x)), y: Math.min(100, Math.max(0, y)) });
  }

  function handleTouchStart(e: TouchEvent<HTMLDivElement>) {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }

  // A mostly-horizontal drag swipes to the next/previous slide; a drag too small in both axes
  // to count as a swipe opens the lightbox instead — touch's equivalent of the desktop
  // pan-zoom click, since touch never triggers toggleZoom above. A mostly-vertical drag (the
  // page scrolling under a finger that started on the image) does neither.
  function handleTouchEnd(e: TouchEvent<HTMLDivElement>) {
    if (touchStartX.current == null || touchStartY.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;
    if (Math.abs(dx) > SWIPE_THRESHOLD_PX && Math.abs(dx) > Math.abs(dy)) {
      go(dx < 0 ? 1 : -1);
    } else if (Math.abs(dx) < TAP_THRESHOLD_PX && Math.abs(dy) < TAP_THRESHOLD_PX) {
      openLightbox();
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
          className={`relative aspect-square overflow-hidden touch-pan-y select-none ${zoomed ? "cursor-zoom-out" : activeSlide.url ? "cursor-zoom-in" : ""
            }`}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onPointerUp={toggleZoom}
          onMouseMove={panZoom}
          onMouseLeave={() => setZoomed(false)}
        >
          {activeSlide.url ? (
            <>
              <Image
                src={activeSlide.url}
                alt={activeSlide.alt ?? ""}
                fill
                // 110vw/220vw, not 50vw/100vw — the click-to-zoom below stretches this same
                // <Image> 2.2x via a CSS transform, which `sizes` otherwise has no way to know
                // about. Without the multiplier, the browser picks a srcset candidate sized for
                // the un-zoomed box and that bitmap gets visibly upscaled on zoom. Scaling the
                // `sizes` value by the same 2.2x makes the browser request enough real pixels
                // up front (capped at the source image's own resolution — up to 2000x2500px —
                // so this never asks for more than the upload actually has).
                sizes="(min-width: 1024px) 110vw, 220vw"
                quality={90}
                className={`object-contain transition-transform duration-150 ease-out ${zoomed ? "scale-[2.2]" : ""}`}
                style={zoomed ? { transformOrigin: `${zoomOrigin.x}% ${zoomOrigin.y}%` } : undefined}
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

          {/* Desktop's click already drives the pan-zoom above, so the full-screen viewer gets
              its own explicit control there. Touch has no such conflict — tapping the image
              (handleTouchEnd) opens the lightbox directly, so no button is needed on mobile. */}
          {activeSlide.url && (
            <button
              onPointerUp={(e) => {
                e.stopPropagation();
                openLightbox();
              }}
              aria-label="View full screen"
              className="absolute right-2 top-2 z-[6] hidden rounded-full bg-ink/70 p-2 desktop:flex"
            >
              <ExpandIcon className="h-4 w-4 text-lime" />
            </button>
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

          <div className="relative flex-1" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
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

function ExpandIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M3 16v3a2 2 0 0 0 2 2h3" />
    </svg>
  );
}
