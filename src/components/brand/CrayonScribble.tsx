/**
 * A fan of textured crayon strokes — the decorative mark scattered across open
 * space on storefront pages (hero corners, section breaks, footer). Purely
 * presentational SVG; `id` only needs to be unique among CrayonScribble
 * instances rendered on the same page (it seeds the filter + noise pattern).
 */
export function CrayonScribble({
  id,
  color = "var(--color-ic-pink)",
  className,
  strokeCount = 5,
}: {
  id: string;
  color?: string;
  className?: string;
  strokeCount?: 4 | 5 | 6;
}) {
  const filterId = `crayon-tex-${id}`;
  const strokes = Array.from({ length: strokeCount }, (_, i) => {
    const t = i / (strokeCount - 1);
    const x1 = 8 + t * 92;
    const y1 = 96 - t * 6;
    const x2 = 40 + t * 78;
    const y2 = 6 + t * 34;
    return <path key={i} d={`M${x1},${y1} L${x2},${y2}`} />;
  });

  return (
    <svg viewBox="0 0 130 100" className={className} aria-hidden="true">
      <defs>
        <filter id={filterId} x="-30%" y="-30%" width="160%" height="160%">
          <feTurbulence type="fractalNoise" baseFrequency="0.06 0.5" numOctaves="2" seed={id.length + strokeCount} result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="4" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
      <g filter={`url(#${filterId})`} stroke={color} strokeWidth="7" strokeLinecap="round" fill="none" opacity="0.9">
        {strokes}
      </g>
    </svg>
  );
}
