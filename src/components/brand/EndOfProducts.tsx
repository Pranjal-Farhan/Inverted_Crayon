import { RainbowWord } from "@/components/brand/RainbowWord";

/**
 * Shown at the bottom of a product grid once there's genuinely nothing left to load — homepage
 * "New In" (NewInGrid.tsx) once Load more is exhausted, and every static PLP (StaticPLPClient.tsx:
 * /men/[category], /women/[category], /sale, /new, /search) once its last page is showing. Reuses
 * existing building blocks rather than new ones: .preorder-blink (globals.css) for the blink, and
 * RainbowWord for the per-letter crayon-box coloring already used on the wordmark — both already
 * neutralized under prefers-reduced-motion by globals.css's blanket animation-duration override.
 */
export function EndOfProducts() {
  return (
    <div className="my-10 flex flex-col items-center gap-1.5 text-center">
      <p className="preorder-blink font-scrawl text-[22px] leading-tight desktop:text-[28px]">
        <RainbowWord text="That's the whole box!" />
      </p>
      <p className="font-label text-[12px] tracking-[1.4px] text-muted">You&apos;ve seen every last crayon.</p>
    </div>
  );
}
