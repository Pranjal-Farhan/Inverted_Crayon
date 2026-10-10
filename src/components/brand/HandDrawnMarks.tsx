"use client";

import { useEffect, useState } from "react";

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
  stretch = false,
}: {
  id: string;
  kind: MarkKind;
  color?: string;
  duration?: number;
  delay?: number;
  className?: string;
  /** Stretch to fill the container's own aspect ratio instead of preserving the mark's native
   * one — for a straight line (e.g. "strike") meant to span an arbitrary-width element, where
   * non-uniform scaling doesn't read as distorted the way it would for a rounder shape. */
  stretch?: boolean;
}) {
  // Reduced-motion starts already "drawn" (lazy initializer, not an effect setState) — see
  // ProductCard's tilt effect for the same convention. Everyone else starts undrawn and the
  // effect below flips it true a frame later, which is what makes the stroke transition run.
  const [playing, setPlaying] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    if (playing) return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setPlaying(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [playing]);

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
        strokeWidth={shape.strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {shape.paths.map((d, i) => (
          <path
            key={i}
            d={d}
            pathLength={1}
            className="hdm-path"
            style={{
              strokeDasharray: 1,
              strokeDashoffset: playing ? 0 : 1,
              transitionDuration: `${duration}ms`,
              transitionDelay: `${delay + i * 140}ms`,
            }}
          />
        ))}
      </g>
    </svg>
  );
}
