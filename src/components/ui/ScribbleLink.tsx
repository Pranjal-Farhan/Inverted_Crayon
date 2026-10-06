import Link from "next/link";
import type { ReactNode } from "react";

/**
 * A nav/footer link with a hand-drawn underline that strokes itself in on hover — a small
 * extension of the brand's existing .scrawl-underline treatment. Pure CSS (:hover-driven
 * stroke-dashoffset), so this stays a Server Component and needs no client JS.
 */
export function ScribbleLink({
  href,
  className = "",
  stroke,
  onClick,
  prefetch,
  children,
}: {
  href: string;
  className?: string;
  /** Underline color — defaults to the link's own text color (currentColor). */
  stroke?: string;
  onClick?: () => void;
  /** Forwarded to next/link. Default (undefined) lets Next decide; pass false for a link to a personalized/dynamic page. */
  prefetch?: boolean;
  children: ReactNode;
}) {
  return (
    <Link href={href} onClick={onClick} prefetch={prefetch} className={`scribble-link ${className}`}>
      {children}
      <svg viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true" style={stroke ? ({ "--scribble-stroke": stroke } as React.CSSProperties) : undefined}>
        <path d="M2 6 C 20 2, 45 9, 62 5 S 90 2, 98 6" />
      </svg>
    </Link>
  );
}
