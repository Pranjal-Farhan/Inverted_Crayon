"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode, type RefObject, type TouchEvent } from "react";
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
 *
 * On a phone there is no hovering, so the wheel is a peek: hold a finger still on a card for a
 * moment and it opens; lift the finger (or slide it off the card) and it closes. Any real movement
 * is a scroll, not a hold, so it never opens while scrolling the page.
 *
 * The circles show small thumbnails from /api/product-images/[id]/thumb (a few KB each, made once
 * and cached for a year — src/lib/image-thumb.ts), not the photos through next/image: shrinking a
 * multi-MB original on demand is what used to leave the circles blank for seconds. They start
 * loading as soon as a pointer or finger arrives, before the wheel itself has opened.
 */

/** Every mark in the shop draws in 500ms (the card's circle, the category cards'); the wheel keeps pace. */
const DRAW_MS = 500;
/** How long the wheel stays on the page once it starts to leave: the rim's undraw plus its second pass's 140ms head start. */
const EXIT_MS = DRAW_MS + 200;
/** The pointer has to rest on a card this long before its wheel opens, so sweeping across a grid doesn't open one on every card it crosses. */
const OPEN_DELAY_MS = 120;
/** A finger has to rest this long, without moving, before the wheel opens (a tap or the start of a scroll must not open one). */
const HOLD_MS = 220;
/** A finger that moves further than this is scrolling or dragging, not holding. */
const HOLD_SLOP_PX = 10;
/** The thumbnails start loading this long after the pointer or finger arrives — soon enough to be ready as the wheel opens, late enough that sweeping past a card fetches nothing. */
const WARM_DELAY_MS = 50;
/** After a peek, the click the browser sends when the finger lifts is ignored for this long (it must not open the product). */
const SWALLOW_MS = 800;
/** Mouse events the browser makes up after a touch arrive within this long of it — not a real mouse. */
const TOUCH_ECHO_MS = 700;
/** How far the wheel tucks over the card's own edge, so there is never a hairline gap between them. */
const TUCK = 3;

export type WheelImage = { id: string; url: string; accentColor: string | null };

/** The address a circle loads its picture from, or null when the slot has no usable photo (it shows the placeholder frame). */
function thumbSrc(img: WheelImage): string | null {
  const u = img.url.trim();
  if (!u) return null;
  // The very oldest uploads are stored inline: they are their own address.
  if (u.startsWith("data:")) return /^data:image\/(?:png|jpe?g|webp|gif|avif);base64,/i.test(u) ? u : null;
  // Anything the endpoint could possibly make a thumbnail of. It decides for itself where it is willing
  // to download an original from (image-thumb.ts), so a stray address can never make the browser load a
  // foreign host — the worst it gets is a 404 and the placeholder.
  if (/^https?:\/\//i.test(u) || (u.startsWith("/") && !u.startsWith("//"))) return `/api/product-images/${encodeURIComponent(img.id)}/thumb`;
  return null;
}

const warmed = new Set<string>();

/**
 * Starts fetching a product's thumbnails so the browser already has them when the wheel opens. Called
 * as soon as a pointer or finger has rested on the card for a moment; each address is only ever warmed
 * once (they are cached for a year after that).
 */
export function warmWheelThumbs(images: WheelImage[]) {
  for (const img of images.slice(0, WHEEL_MAX_IMAGES)) {
    const src = thumbSrc(img);
    if (!src || src.startsWith("data:") || warmed.has(src)) continue;
    warmed.add(src);
    const el = new Image();
    el.decoding = "async";
    el.src = src;
  }
}

/**
 * Hover (mouse) and hold (finger) for a card's wheel. A mouse opens it after resting on the card for
 * OPEN_DELAY_MS; a finger after resting there, still, for HOLD_MS — and a finger that moves is
 * scrolling, so it opens nothing and closes a wheel that is already up.
 *
 * A peek must not also open the product: the click the browser sends when the finger lifts is ignored
 * (`clickCapture`) if the wheel had opened. And since holding a finger on a link is also how a phone
 * opens its own link menu, that menu is suppressed (`contextMenu`, plus the `wheel-card` class in
 * globals.css for iOS and text selection) on cards that have a wheel — and only on those, only for
 * touch. `enabled` is false for a product with too few photos for a wheel: nothing here then does
 * anything, and the card behaves exactly as a plain link.
 */
export function useWheelHover({ enabled, warm }: { enabled: boolean; warm: () => void }) {
  const [open, setOpen] = useState(false);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const swallowTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finger = useRef<{ x: number; y: number } | null>(null);
  const swallow = useRef(false);
  const lastTouch = useRef(0);

  const clearTimers = () => {
    if (openTimer.current) clearTimeout(openTimer.current);
    if (warmTimer.current) clearTimeout(warmTimer.current);
    openTimer.current = null;
    warmTimer.current = null;
  };

  useEffect(
    () => () => {
      if (openTimer.current) clearTimeout(openTimer.current);
      if (warmTimer.current) clearTimeout(warmTimer.current);
      if (swallowTimer.current) clearTimeout(swallowTimer.current);
    },
    [],
  );

  function schedule(delay: number, onOpen?: () => void) {
    clearTimers();
    warmTimer.current = setTimeout(warm, Math.min(WARM_DELAY_MS, delay));
    openTimer.current = setTimeout(() => {
      onOpen?.();
      setOpen(true);
    }, delay);
  }

  return {
    open,
    // ---- mouse
    enter() {
      if (!enabled || typeof window === "undefined" || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
      // A touch screen's made-up mouse events (it sends them after a tap) are not a pointer arriving.
      if (Date.now() - lastTouch.current < TOUCH_ECHO_MS) return;
      schedule(OPEN_DELAY_MS);
    },
    leave() {
      clearTimers();
      setOpen(false);
    },
    // ---- finger
    touchStart(e: TouchEvent) {
      if (!enabled) return;
      lastTouch.current = Date.now();
      swallow.current = false;
      if (swallowTimer.current) clearTimeout(swallowTimer.current);
      const t = e.touches[0];
      if (e.touches.length !== 1 || !t) {
        // A second finger (a pinch) is not a hold.
        finger.current = null;
        clearTimers();
        setOpen(false);
        return;
      }
      finger.current = { x: t.clientX, y: t.clientY };
      schedule(HOLD_MS, () => {
        // From here this touch is a peek: its click must not open the product.
        if (finger.current) swallow.current = true;
      });
    },
    touchMove(e: TouchEvent) {
      const start = finger.current;
      const t = e.touches[0];
      if (!start || !t) return;
      if (Math.hypot(t.clientX - start.x, t.clientY - start.y) > HOLD_SLOP_PX) {
        finger.current = null;
        clearTimers();
        setOpen(false);
      }
    },
    touchEnd() {
      if (!enabled) return;
      lastTouch.current = Date.now();
      finger.current = null;
      clearTimers();
      setOpen(false);
      // The click for this touch (if the browser sends one) arrives right after; after that, forget it.
      if (swallow.current) swallowTimer.current = setTimeout(() => (swallow.current = false), SWALLOW_MS);
    },
    clickCapture(e: MouseEvent) {
      if (!swallow.current) return;
      swallow.current = false;
      e.preventDefault();
      e.stopPropagation();
    },
    contextMenu(e: MouseEvent) {
      if (enabled && (finger.current || swallow.current)) e.preventDefault();
    },
  };
}

/**
 * One circle's picture: the thumbnail fades in over the dark circle as it arrives, and a photo that
 * can't be had (no usable address, a 404, an unreachable host) shows the placeholder frame instead.
 */
function WheelPhoto({ src, size, fallback }: { src: string | null; size: number; fallback: ReactNode }) {
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  if (!src || state === "failed") return <>{fallback}</>;
  return (
    // A plain <img>, on purpose: this is a few-KB thumbnail from our own endpoint, and next/image's
    // resize-on-demand (which downloads the multi-MB original first) is exactly what is being avoided.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      decoding="async"
      loading="eager"
      draggable={false}
      onLoad={() => setState("ready")}
      onError={() => setState("failed")}
      className="absolute inset-0 h-full w-full object-cover"
      style={{ opacity: state === "ready" ? 1 : 0, transition: "opacity 180ms ease-out" }}
    />
  );
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
            <WheelPhoto
              src={thumbSrc(img)}
              size={size}
              fallback={<PlaceholderFrame accentColor={img.accentColor ?? accent} shape={shape} stamp={false} className="h-full w-full" />}
            />
          </div>
        );
      })}
    </div>,
    document.body,
  );
}
