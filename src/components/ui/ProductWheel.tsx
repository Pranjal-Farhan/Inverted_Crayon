"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { HandDrawnMark } from "@/components/brand/HandDrawnMarks";
import { PlaceholderFrame } from "@/components/ui/PlaceholderFrame";
import { WHEEL_MAX_IMAGES, WHEEL_MIN_IMAGES, layoutWheel, type WheelLayout } from "@/lib/product-wheel";

/**
 * The product "half wheel": while the pointer rests on a product card, a half-disc of small round
 * thumbnails — every photo of that product, for an at-a-glance overview — fans out from the card's
 * side, over the neighbouring card or the free space beside it. It opens away from the card's own
 * side of the page (a card on the left opens to the right, one on the right opens to the left) and
 * is drawn on and undrawn at the same speed as the crayon "circle this" mark the card already draws.
 *
 * It is rendered in a portal on the page itself rather than inside the card: the grids and rails
 * the cards live in clip anything that sticks out of them, and the wheel has to sit above the
 * neighbouring cards. It never takes the pointer (pointer-events: none), so the card beneath it
 * still gets the hover — which is also what makes it close the moment the pointer moves on.
 */

/** Every mark in the shop draws in 500ms (the card's circle, the category cards'); the wheel keeps pace. */
const DRAW_MS = 500;
/** How long the wheel stays on the page once it starts to leave: the rim's undraw plus its second pass's 140ms head start. */
const EXIT_MS = DRAW_MS + 200;
/** The pointer has to rest on a card this long before its wheel opens, so sweeping across a grid doesn't open one on every card it crosses. */
const OPEN_DELAY_MS = 120;
/** How far the wheel tucks over the card's own edge, so there is never a hairline gap between them. */
const TUCK = 3;

export type WheelImage = { id: string; url: string; accentColor: string | null };

/**
 * Mouse hover for a card's wheel. Only a real mouse opens it: on a phone or tablet there is no
 * hovering, and a wheel popping up under a finger would only be in the way (the pointer query is
 * read when the pointer arrives, so a laptop that also has a touchscreen still behaves as a laptop).
 * Spread `enter`/`leave` onto the card's own mouse handlers.
 */
export function useWheelHover() {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return {
    open,
    enter() {
      if (typeof window === "undefined" || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setOpen(true), OPEN_DELAY_MS);
    },
    leave() {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      setOpen(false);
    },
  };
}

/**
 * Whether <Image> will take this address: this site's own files, inline images, or the hosts
 * next.config.ts allows (images.remotePatterns). <Image> throws on anything else — and the wheel
 * draws every photo of a product, not just the cover the card itself shows, so one odd address on
 * a later photo must not be able to take the whole page down on hover. Such a slot shows the
 * placeholder frame instead.
 */
function showable(url: string): boolean {
  const u = url.trim();
  if (!u) return false;
  if (u.startsWith("/")) return !u.startsWith("//");
  if (u.startsWith("data:image/")) return true;
  try {
    const { protocol, hostname } = new URL(u);
    return protocol === "https:" && (hostname === "i.ibb.co" || hostname.endsWith(".googleusercontent.com"));
  } catch {
    return false;
  }
}

type Placement = { side: "left" | "right"; left: number; top: number; layout: WheelLayout };

/** Where the wheel goes: beside the card, on whichever side has the room, centred on it, kept on screen. */
function place(rect: DOMRect, layout: WheelLayout): Placement {
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  const side = rect.left + rect.width / 2 < vw / 2 ? "right" : "left";
  let x = side === "right" ? rect.right - TUCK : rect.left + TUCK - layout.width;
  x = Math.min(Math.max(x, 4), Math.max(4, vw - layout.width - 4));
  // Centred on the card, but never under the sticky header (the site already exposes its height as
  // scroll-padding-top, which every in-page jump respects too) and never off the bottom of the window.
  const topMin = Math.max(8, parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0);
  let y = rect.top + rect.height / 2 - layout.height / 2;
  y = Math.min(Math.max(y, topMin), Math.max(topMin, vh - layout.height - 8));
  // Page coordinates, so the wheel scrolls with the page it is attached to.
  return { side, left: x + window.scrollX, top: y + window.scrollY, layout };
}

export function ProductWheel({
  open,
  anchorRef,
  images,
  color,
  accent,
  shape,
  seed,
}: {
  /** Whether the pointer is resting on the card (see useWheelHover). */
  open: boolean;
  /** The card's photo box — the wheel is centred on it and attached to its edge. */
  anchorRef: RefObject<HTMLElement | null>;
  images: WheelImage[];
  /** The rim's colour — the same one the card's own hover mark is drawn in. */
  color: string;
  /** Colour and shape of the placeholder frame for a photo slot that has no picture yet. */
  accent: string;
  shape: "x" | "circle" | "square";
  /** Unique on the page — seeds the crayon texture. */
  seed: string;
}) {
  const slides = useMemo(() => images.slice(0, WHEEL_MAX_IMAGES), [images]);
  const enough = slides.length >= WHEEL_MIN_IMAGES;

  // `mounted`: on the page at all. `shown`: drawn on. They differ at both ends — a wheel is mounted
  // one frame before it is shown (so every transition has a starting frame to run from) and stays
  // mounted until its undraw has finished.
  const [mounted, setMounted] = useState(false);
  const [shown, setShown] = useState(false);
  const [placement, setPlacement] = useState<Placement | null>(null);
  // True from the moment a wheel starts to open until it has finished leaving, so the ~40 cards
  // that never open one don't each schedule a timer for nothing.
  const live = useRef(false);

  useEffect(() => {
    let r1 = 0;
    let r2 = 0;
    let r3 = 0;
    let t: ReturnType<typeof setTimeout> | undefined;
    if (open && enough) {
      live.current = true;
      r1 = requestAnimationFrame(() => {
        const el = anchorRef.current;
        if (!el) return;
        // The layout is worked out here, when a wheel actually opens, not when the card renders —
        // a page of forty cards shouldn't pay for forty layouts it will never show (it is cached per count).
        setPlacement(place(el.getBoundingClientRect(), layoutWheel(slides.length)));
        setMounted(true);
        r2 = requestAnimationFrame(() => {
          r3 = requestAnimationFrame(() => setShown(true));
        });
      });
    } else if (live.current) {
      r1 = requestAnimationFrame(() => setShown(false));
      t = setTimeout(() => {
        live.current = false;
        setMounted(false);
      }, EXIT_MS);
    }
    return () => {
      cancelAnimationFrame(r1);
      cancelAnimationFrame(r2);
      cancelAnimationFrame(r3);
      if (t) clearTimeout(t);
    };
  }, [open, enough, slides.length, anchorRef]);

  // While the wheel is up it stays glued to its card: the card may still be sliding into place from
  // the page's own reveal animation when the wheel opens, or the page may shift under it (a photo
  // finishing loading above it), and a wheel measured once would be left where the card used to be.
  // Re-measuring each frame costs nothing — one wheel at a time, and the state only changes when the
  // card has actually moved.
  const layout = placement?.layout ?? null;
  useEffect(() => {
    if (!open || !mounted || !layout) return;
    let raf = 0;
    const follow = () => {
      const el = anchorRef.current;
      if (el) {
        const next = place(el.getBoundingClientRect(), layout);
        setPlacement((cur) =>
          cur && cur.side === next.side && Math.abs(cur.left - next.left) < 0.5 && Math.abs(cur.top - next.top) < 0.5 ? cur : next,
        );
      }
      raf = requestAnimationFrame(follow);
    };
    raf = requestAnimationFrame(follow);
    return () => cancelAnimationFrame(raf);
  }, [open, mounted, layout, anchorRef]);

  if (!mounted || !placement) return null;

  const { side, left, top } = placement;
  const mirror = side === "left";
  const { size, radius, width, height } = placement.layout;
  const hubX = mirror ? width : 0;
  const hubY = radius;
  const stagger = Math.min(40, 220 / Math.max(1, placement.layout.tiles.length));

  return createPortal(
    <div aria-hidden="true" className="pointer-events-none absolute z-[60]" style={{ left, top, width, height }}>
      {/* The disc: grows out of the card's edge while the rim is drawn, shrinks back into it as the rim is undrawn. */}
      <div
        className="absolute inset-0"
        style={{
          borderRadius: mirror ? `${radius}px 0 0 ${radius}px` : `0 ${radius}px ${radius}px 0`,
          background: `radial-gradient(circle at ${mirror ? "100%" : "0%"} 50%, rgba(34,34,40,.97), rgba(10,10,12,.97) 75%)`,
          boxShadow: "0 14px 40px rgba(0,0,0,.55)",
          transformOrigin: `${mirror ? "100%" : "0%"} 50%`,
          transform: shown ? "none" : "scale(.4)",
          opacity: shown ? 1 : 0,
          transition: shown
            ? "transform 420ms cubic-bezier(.2,.9,.25,1), opacity 260ms ease-out"
            : "transform 300ms cubic-bezier(.4,0,.8,.4), opacity 300ms ease-in",
        }}
      />
      {/* The crayon rim — the same draw-on / undraw as the card's own mark, mirrored for a wheel that opens left. */}
      <div className="absolute inset-0" style={{ transform: mirror ? "scaleX(-1)" : undefined }}>
        <HandDrawnMark id={`wheel-${seed}`} kind="half-wheel" color={color} duration={DRAW_MS} visible={shown} stretch className="h-full w-full" />
      </div>
      {/* The photos, fanning out from the hub (the middle of the flat edge) to their places on the rings. */}
      {slides.map((img, i) => {
        const t = placement.layout.tiles[i];
        // The photos could change under an open wheel (a refresh of the shop's data): until it re-measures, show what fits.
        if (!t) return null;
        const cx = mirror ? width - t.x : t.x;
        const delay = Math.round(i * stagger);
        return (
          <div
            key={img.id}
            className="absolute overflow-hidden rounded-full bg-panel-2"
            style={{
              left: cx - size / 2,
              top: t.y - size / 2,
              width: size,
              height: size,
              border: `2px solid ${i === 0 ? color : "rgba(255,255,255,.85)"}`,
              transform: shown ? "none" : `translate(${hubX - cx}px, ${hubY - t.y}px) scale(.15)`,
              opacity: shown ? 1 : 0,
              transition: shown
                ? `transform ${DRAW_MS - 60}ms cubic-bezier(.2,.9,.25,1.12) ${delay}ms, opacity 200ms ease-out ${delay}ms`
                : "transform 280ms cubic-bezier(.4,0,.8,.4), opacity 220ms ease-in",
            }}
          >
            {showable(img.url) ? (
              <Image src={img.url.trim()} alt="" fill sizes={`${size}px`} quality={75} loading="eager" draggable={false} className="object-cover" />
            ) : (
              <PlaceholderFrame accentColor={img.accentColor ?? accent} shape={shape} stamp={false} className="h-full w-full" />
            )}
          </div>
        );
      })}
    </div>,
    document.body,
  );
}
