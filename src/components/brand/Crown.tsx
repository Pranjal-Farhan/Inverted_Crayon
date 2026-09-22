/**
 * Hand-scrawled crown — secondary flavor accent ("made to stand out").
 * Not a logo: never use in place of the monogram for identity. (§01)
 * Inherits currentColor.
 */
export function Crown({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 90 64" className={className} aria-hidden="true">
      <path
        d="M12 52 L14 14 Q16 8 20 16 L34 40 L44 8 Q47 2 50 10 L62 40 L76 14 Q79 8 81 16 L82 52"
        fill="none"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M9 54 L85 54" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
    </svg>
  );
}
