/**
 * The wordmark — Permanent Marker. INVERTED is always white/ink.
 * CRAYON cycles the palette letter-by-letter, fixed order: pink · cyan ·
 * yellow · lime · pink · cyan. Never re-order or recolor the cycle. (§01)
 */
const CYCLE = ["#ff2d84", "#26a7e6", "#ffd23b", "#c3f53a", "#ff2d84", "#26a7e6"];

export function Wordmark({ className, stacked = true }: { className?: string; stacked?: boolean }) {
  const letters = "CRAYON".split("");
  return (
    <span className={`font-scrawl leading-[0.85] ${className ?? ""}`}>
      <span className="block">INVERTED</span>
      {stacked ? null : " "}
      <span className="block">
        {letters.map((l, i) => (
          <span key={i} style={{ color: CYCLE[i % CYCLE.length] }}>
            {l}
          </span>
        ))}
      </span>
    </span>
  );
}
