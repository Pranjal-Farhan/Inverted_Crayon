/**
 * Geometry of the product "half wheel": the popup of small round photo thumbnails that fans out
 * from the side of a hovered product card (ProductWheel.tsx). Pure maths — no DOM, no React — so
 * the layout can be tested on its own.
 *
 * The wheel is a half-disc whose flat edge sits against the card. Coordinates below are for a wheel
 * opening to the RIGHT (flat edge on the left, x measured from it, y from the top of the wheel's
 * box); a wheel opening to the left is the same picture mirrored in x.
 *
 * Thumbnails sit on one or more concentric arcs ("rings") around the midpoint of the flat edge (the
 * hub). The wheel is as compact as the photos allow: for each thumbnail size, from the biggest
 * down, every way of dealing the photos onto 1–4 rings is packed as tightly as it will go, and the
 * biggest size whose smallest wheel stays within the size limit wins. A product with a couple of
 * photos gets a small wheel of big thumbnails; a product with twenty gets three rings of small ones.
 */

/** A product with fewer photos than this gets no wheel — an overview of one picture overviews nothing. */
export const WHEEL_MIN_IMAGES = 2;
/** Most thumbnails a wheel will show (a product can hold 20 photos). */
export const WHEEL_MAX_IMAGES = 24;

/** Clear space between neighbouring thumbnails. */
const GAP = 8;
/** How far from the horizontal axis a ring's thumbnails may spread, in degrees, each way. */
const HALF_SPAN = (70 * Math.PI) / 180;
/** Where the crayon arc is drawn, as a fraction of the half-disc's radius (see "half-wheel" in HandDrawnMarks). */
export const WHEEL_ARC_FRACTION = 0.94;
/** Clear space between the outermost thumbnails and the crayon arc. */
const ARC_CLEARANCE = 12;
const MAX_RINGS = 4;
/** Thumbnail diameters to try, biggest first. */
const TILE_SIZES = [60, 54, 48, 44, 40, 36, 32, 28];
/**
 * What counts as "small enough": the half-disc's radius (the wheel is twice that tall) and the
 * smallest thumbnail we're willing to shrink to in order to get there. The first row that can be
 * satisfied wins, with the biggest thumbnails that fit; if none can (a very full wheel), the
 * smallest wheel there is is used.
 */
const TIERS = [
  { maxRadius: 165, minSize: 44 },
  { maxRadius: 195, minSize: 36 },
  { maxRadius: 215, minSize: 30 },
];

export type WheelLayout = {
  /** Thumbnail diameter, px. */
  size: number;
  /** Radius of the half-disc, px. The wheel's box is `radius` wide and `2 * radius` tall. */
  radius: number;
  width: number;
  height: number;
  /** One centre per image, in image order: rings from the inside out, each ring from the top down. */
  tiles: { x: number; y: number }[];
};

/** Smallest ring radius that holds `n` thumbnails of `size` without touching and clear of the flat edge. */
function minRadius(n: number, size: number): number | null {
  const clearance = size / 2 + 8; // the end thumbnails' inner edges stay this far from the card's edge
  if (n === 1) return clearance;
  const d = size + GAP;
  for (let r = clearance; r <= 420; r += 1) {
    const half = (n - 1) * Math.asin(Math.min(1, d / (2 * r))); // half of the angle the ring's thumbnails span
    if (half <= HALF_SPAN && r * Math.cos(half) >= clearance) return r;
  }
  return null;
}

type Plan = { radii: number[]; counts: number[]; radius: number };

/** Every way of dealing `n` thumbnails onto `rings` rings, inner ring never fuller than the next. */
function* splits(n: number, rings: number, min = 1): Generator<number[]> {
  if (rings === 1) {
    if (n >= min) yield [n];
    return;
  }
  for (let first = min; first * rings <= n; first++) {
    for (const rest of splits(n - first, rings - 1, first)) yield [first, ...rest];
  }
}

function planFor(n: number, size: number): Plan | null {
  let best: Plan | null = null;
  for (let rings = 1; rings <= MAX_RINGS; rings++) {
    for (const counts of splits(n, rings)) {
      const radii: number[] = [];
      let ok = true;
      for (let k = 0; k < rings; k++) {
        const own = minRadius(counts[k], size);
        if (own == null) {
          ok = false;
          break;
        }
        radii.push(k === 0 ? own : Math.max(own, radii[k - 1] + size + GAP + 2));
      }
      if (!ok) continue;
      const radius = (radii[rings - 1] + size / 2 + ARC_CLEARANCE) / WHEEL_ARC_FRACTION;
      // Smallest wheel wins; between equals, fewer rings (a plainer wheel).
      if (!best || radius < best.radius - 0.5 || (Math.abs(radius - best.radius) <= 0.5 && counts.length < best.counts.length)) {
        best = { radii, counts, radius };
      }
    }
  }
  return best;
}

const cache = new Map<number, WheelLayout>();

export function layoutWheel(rawCount: number): WheelLayout {
  const count = Math.max(1, Math.min(WHEEL_MAX_IMAGES, Math.floor(rawCount)));
  const hit = cache.get(count);
  if (hit) return hit;

  let chosen: { size: number; plan: Plan } | null = null;
  for (const tier of TIERS) {
    for (const size of TILE_SIZES) {
      if (size < tier.minSize) continue;
      const plan = planFor(count, size);
      if (plan && plan.radius <= tier.maxRadius) {
        chosen = { size, plan };
        break;
      }
    }
    if (chosen) break;
  }
  if (!chosen) {
    // Nothing meets any limit: take whichever size makes the smallest wheel.
    for (const size of TILE_SIZES) {
      const plan = planFor(count, size);
      if (plan && (!chosen || plan.radius < chosen.plan.radius)) chosen = { size, plan };
    }
  }
  if (!chosen) throw new Error(`No wheel layout for ${count} images`);

  const { size, plan } = chosen;
  const d = size + GAP;
  const clearance = size / 2 + 8;
  const midY = plan.radius; // the wheel's box is 2 * radius tall; the hub is its vertical middle
  const tiles: { x: number; y: number }[] = [];
  for (let k = 0; k < plan.radii.length; k++) {
    const n = plan.counts[k];
    const r = plan.radii[k];
    // Spread across as much of the arc as is free (clear of the flat edge) when the ring is full; a
    // sparse ring keeps its thumbnails together rather than flinging two of them to the far ends.
    const halfMax = Math.min(HALF_SPAN, Math.acos(Math.min(1, clearance / r)));
    const step = n > 1 ? Math.min((2 * halfMax) / (n - 1), (d + 18) / r) : 0;
    for (let j = 0; j < n; j++) {
      const a = (j - (n - 1) / 2) * step;
      tiles.push({ x: r * Math.cos(a), y: midY + r * Math.sin(a) });
    }
  }
  const layout: WheelLayout = { size, radius: plan.radius, width: plan.radius, height: 2 * plan.radius, tiles };
  cache.set(count, layout);
  return layout;
}
