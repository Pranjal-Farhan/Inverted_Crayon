/**
 * Scribble accent set — X, circle, square-frame, underline, arrow.
 * Used across placeholder image wells (Appendix A). CSS/SVG, not raster,
 * so it stays crisp at any size (§11 performance note).
 */
type Shape = "x" | "circle" | "square" | "underline" | "arrow" | "oval";

export function Scribble({
  shape,
  color = "#ff2d84",
  className,
}: {
  shape: Shape;
  color?: string;
  className?: string;
}) {
  switch (shape) {
    case "x":
      return (
        <svg viewBox="0 0 200 230" className={className} aria-hidden="true">
          <path
            d="M40 40 L160 190 M160 40 L40 190"
            stroke={color}
            strokeWidth="11"
            strokeLinecap="round"
            opacity=".8"
          />
        </svg>
      );
    case "circle":
      return (
        <svg viewBox="0 0 200 230" className={className} aria-hidden="true">
          <circle cx="100" cy="110" r="72" fill="none" stroke={color} strokeWidth="11" opacity=".8" />
        </svg>
      );
    case "square":
      return (
        <svg viewBox="0 0 200 230" className={className} aria-hidden="true">
          <rect x="42" y="52" width="116" height="116" fill="none" stroke={color} strokeWidth="10" opacity=".8" />
        </svg>
      );
    case "underline":
      return (
        <svg viewBox="0 0 200 40" className={className} aria-hidden="true">
          <path d="M8 20 Q100 4 192 20" stroke={color} strokeWidth="7" fill="none" strokeLinecap="round" />
        </svg>
      );
    case "oval":
      return (
        <svg viewBox="0 0 200 100" className={className} preserveAspectRatio="none" aria-hidden="true">
          <path
            d="M14,52 C9,21 62,3 101,5 C147,7 196,17 190,49 C195,83 138,98 99,96 C53,94 7,87 14,52 Z"
            stroke={color}
            strokeWidth="6"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
      );
    case "arrow":
      return (
        <svg viewBox="0 0 24 16" className={className} aria-hidden="true">
          <path
            d="M2 8h18M15 2l6 6-6 6"
            fill="none"
            stroke={color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
  }
}
