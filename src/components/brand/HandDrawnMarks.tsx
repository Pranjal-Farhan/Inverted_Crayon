"use client";

import { useEffect, useState, type TouchEvent } from "react";

/**
 * Hand-drawn crayon/chalk annotation marks — arrows, circles, checkmarks, brackets — styled after
 * the brand's reference sheets (chalky multi-stroke arrows + annotation marks, never gender-coded
 * colors per accent-color.ts's own convention). Each mark "draws itself" on mount: every path uses
 * `pathLength={1}` so its dash length is normalized regardless of actual geometry, then a plain
 * stroke-dashoffset transition (0 -> 1 -> 0) does the "being drawn in real time" reveal — no JS
 * animation loop, just one state flip a frame after mount so the browser has an initial frame to
 * transition from. Reduced-motion users get the mark fully drawn immediately (see the check below),
 * matching ProductCard's own JS-driven-effect convention (globals.css's blanket animation-duration
 * neutralization only catches CSS-only effects, not a React state flip like this one).
 */

export type MarkKind =
  | "arrow-straight"
  | "arrow-curve"
  | "arrow-zigzag"
  | "arrow-spiral"
  | "circle-loop"
  | "checkmark"
  | "underline"
  | "bracket"
  // Not in MARK_KINDS below on purpose — a single strike-through line, used only by
  // DiscountPriceTag.tsx to cross out an original price, never picked by pickMark's random choice.
  | "strike";

export const MARK_KINDS: MarkKind[] = [
  "arrow-straight",
  "arrow-curve",
  "arrow-zigzag",
  "arrow-spiral",
  "circle-loop",
  "checkmark",
  "underline",
  "bracket",
];

const MARK_COLORS = ["#ff2d84", "#c3f53a", "#26a7e6", "#ffd23b"];

function hash(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

/** Deterministic mark kind + color for a given seed — same convention as accent-color.ts's pickAccent. */
export function pickMark(seed: string, excludeColor?: string): { kind: MarkKind; color: string } {
  const h = hash(seed);
  const kind = MARK_KINDS[h % MARK_KINDS.length];
  let colors = MARK_COLORS;
  if (excludeColor) colors = MARK_COLORS.filter((c) => c !== excludeColor);
  const color = colors[Math.floor(h / MARK_KINDS.length) % colors.length];
  return { kind, color };
}

const SHAPES: Record<MarkKind, { viewBox: string; paths: string[]; strokeWidth: number }> = {
  "arrow-straight": {
    viewBox: "0 0 100 60",
    paths: ["M6,42 Q50,32 86,24", "M68,12 L90,23 L70,34"],
    strokeWidth: 6,
  },
  "arrow-curve": {
    viewBox: "0 0 120 100",
    paths: ["M12,86 C8,46 44,14 96,22", "M78,8 L98,21 L82,38"],
    strokeWidth: 6,
  },
  "arrow-zigzag": {
    viewBox: "0 0 60 120",
    paths: ["M28,6 L46,28 L16,48 L44,70 L14,92 L32,108", "M20,96 L31,112 L44,100"],
    strokeWidth: 6,
  },
  "arrow-spiral": {
    viewBox: "0 0 100 100",
    paths: [
      "M50,50 C50,30 30,28 24,46 C18,66 40,80 60,72 C84,62 84,32 62,18 C44,7 20,12 10,28",
      "M4,16 L9,30 L22,24",
    ],
    strokeWidth: 5.5,
  },
  "circle-loop": {
    viewBox: "0 0 140 90",
    paths: ["M22,46 C20,16 62,4 94,10 C124,16 128,52 96,67 C64,82 14,76 16,48 C17,34 28,24 42,21"],
    strokeWidth: 6,
  },
  checkmark: {
    viewBox: "0 0 70 60",
    paths: ["M8,32 L26,50 L62,8"],
    strokeWidth: 8,
  },
  underline: {
    viewBox: "0 0 130 24",
    paths: ["M6,14 Q34,2 62,13 T124,10"],
    strokeWidth: 6,
  },
  bracket: {
    viewBox: "0 0 44 70",
    paths: ["M34,6 L12,6 L12,64 L34,64"],
    strokeWidth: 6,
  },
  strike: {
    viewBox: "0 0 100 40",
    paths: ["M4,33 Q50,20 96,7"],
    strokeWidth: 5,
  },
};

export function HandDrawnMark({
  id,
  kind,
  color = "#ff2d84",
  duration = 700,
  delay = 0,
  className,
  visible,
  stretch = false,
  loop = false,
  loopHoldMs = 1800,
  loopGapMs = 450,
  strokeWidth,
}: {
  id: string;
  kind: MarkKind;
  color?: string;
  duration?: number;
  delay?: number;
  className?: string;
  /** Overrides the shape's own default stroke width (see SHAPES above) — for a mark that needs to
   * read bolder/thinner than its kind's usual weight at a given size. */
  strokeWidth?: number;
  /** Controlled mode — when set, this (not the auto-play-on-mount effect below) drives the
   * stroke-dashoffset, so the same draw transition runs in reverse ("undraws") whenever it flips
   * back to false. Hover-triggered marks pass their own hover boolean here. Reduced-motion still
   * works with no extra guard: globals.css's blanket `transition-duration: 0.001ms !important`
   * neutralizes the inline transitionDuration below exactly as it does in uncontrolled mode. */
  visible?: boolean;
  /** Stretch to fill the container's own aspect ratio instead of preserving the mark's native one
   * — for a mark meant to roughly cover a card regardless of that card's shape, or for a straight
   * line (e.g. "strike") meant to span an arbitrary-width element, where non-uniform scaling
   * doesn't read as distorted the way it would for a rounder shape. */
  stretch?: boolean;
  /** Uncontrolled-mode only (ignored when `visible` is set): instead of drawing once on mount and
   * staying drawn, keep drawing and undrawing forever — draw, hold for `loopHoldMs`, undraw, hold
   * undrawn for `loopGapMs`, repeat. Reduced-motion still wins: the mark just sits fully drawn with
   * no cycling, same as the non-loop case. */
  loop?: boolean;
  loopHoldMs?: number;
  loopGapMs?: number;
}) {
  // Reduced-motion starts already "drawn" (lazy initializer, not an effect setState) — see
  // ProductCard's tilt effect for the same convention. Everyone else starts undrawn and the
  // effect below flips it true a frame later, which is what makes the stroke transition run.
  // Only relevant in uncontrolled (auto-play-on-mount) mode — see the early return below.
  const [autoPlaying, setAutoPlaying] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    if (visible !== undefined || loop) return; // controlled, or handled by the loop effect below
    // Reduced-motion is already drawn via the lazy initializer above — nothing left to animate.
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (autoPlaying) return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setAutoPlaying(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [visible, autoPlaying, loop]);

  useEffect(() => {
    if (visible !== undefined || !loop) return; // controlled, or one-shot — handled above
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Looping mode: draw, hold, undraw, hold, repeat — forever, until unmounted. The path's own
    // opacity only snaps to 0 once its undraw transition actually finishes (it's delayed by
    // `duration` so the stroke visibly retracts before the dot disappears, per the path-rendering
    // comment below) — so the "undrawn" hold has to start counting only after that transition
    // would have completed, or the next redraw interrupts it and the mark never visibly vanishes.
    // Deliberately NOT depending on `autoPlaying`: this effect drives it over time through its own
    // setTimeout chain, independent of re-renders — adding it as a dependency would tear this
    // effect down and restart it (back to step one, "draw now") on every single tick.
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    function schedule(next: boolean, afterMs: number) {
      timer = setTimeout(() => {
        if (cancelled) return;
        setAutoPlaying(next);
        schedule(!next, next ? loopHoldMs : loopGapMs + duration + delay + 200);
      }, afterMs);
    }
    const raf = requestAnimationFrame(() => schedule(true, 0));
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [visible, loop, loopHoldMs, loopGapMs, duration, delay]);

  const playing = visible !== undefined ? visible : autoPlaying;
  const shape = SHAPES[kind];
  const filterId = `hdm-tex-${id}`;

  return (
    <svg viewBox={shape.viewBox} preserveAspectRatio={stretch ? "none" : undefined} className={className} aria-hidden="true">
      <defs>
        <filter id={filterId} x="-25%" y="-25%" width="150%" height="150%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.08 0.35"
            numOctaves="2"
            seed={hash(id) % 97}
            result="noise"
          />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="3" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
      <g
        filter={`url(#${filterId})`}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth ?? shape.strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {shape.paths.map((d, i) => {
          // Round line caps leave a visible dot at a fully zero-length dash — opacity rides along
          // as a second, near-instant transition so that dot only shows up mid-stroke (while
          // dashoffset is animating) and never sits there as a static artifact at rest: it snaps
          // in immediately when a draw starts, and snaps out only once the undraw has visibly
          // finished retracting (delayed by the full duration).
          const pathDelay = delay + i * 140;
          return (
            <path
              key={i}
              d={d}
              pathLength={1}
              className="hdm-path"
              style={{
                strokeDasharray: 1,
                strokeDashoffset: playing ? 0 : 1,
                opacity: playing ? 1 : 0,
                transitionProperty: "stroke-dashoffset, opacity",
                transitionDuration: `${duration}ms, 1ms`,
                transitionDelay: playing ? `${pathDelay}ms, ${pathDelay}ms` : `${pathDelay}ms, ${pathDelay + duration}ms`,
              }}
            />
          );
        })}
      </g>
    </svg>
  );
}

/**
 * Shared hover/focus/touch state for a "circle this" mark — mouse hover and keyboard focus for
 * desktop, plus touch for phones (touchstart draws it, touchend/touchcancel undraws it, and
 * touchmove undraws it the moment the finger slides outside the element it started on, since touch
 * targets don't re-fire enter/leave the way a mouse pointer does). Spread `handlers` onto whichever
 * element should count as "touching/hovering this card," and drive a sibling <HandDrawnMark>'s
 * `visible` prop from `hovered`.
 */
export function useMarkHover<T extends HTMLElement = HTMLElement>() {
  const [hovered, setHovered] = useState(false);
  return {
    hovered,
    handlers: {
      onMouseEnter: () => setHovered(true),
      onMouseLeave: () => setHovered(false),
      onFocus: () => setHovered(true),
      onBlur: () => setHovered(false),
      onTouchStart: () => setHovered(true),
      onTouchEnd: () => setHovered(false),
      onTouchCancel: () => setHovered(false),
      onTouchMove: (e: TouchEvent<T>) => {
        const touch = e.touches[0];
        if (!touch) return;
        const r = e.currentTarget.getBoundingClientRect();
        const inside = touch.clientX >= r.left && touch.clientX <= r.right && touch.clientY >= r.top && touch.clientY <= r.bottom;
        if (!inside) setHovered(false);
      },
    },
  };
}
