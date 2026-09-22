/**
 * The IC monogram — primary mark (Build Spec §01).
 * "I" = inverted lime crayon, tip-down, with a dark band.
 * "C" = hot-pink crayon arc. Fixed yellow tick + cyan dot accents.
 * Min size 24px — below that, drop the accents (see `minimal`).
 */
export function Monogram({ className, minimal = false }: { className?: string; minimal?: boolean }) {
  return (
    <svg viewBox="0 0 92 66" className={className} aria-hidden="true">
      <rect x="16" y="6" width="15" height="38" fill="#c3f53a" />
      <polygon points="16,44 23.5,60 31,44" fill="#c3f53a" />
      <rect x="16" y="25" width="15" height="7" fill="#0c0c0d" />
      <path
        d="M76 16 C53 8 41 24 41 33 C41 42 53 56 76 48"
        fill="none"
        stroke="#ff2d84"
        strokeWidth="12"
        strokeLinecap="round"
      />
      {!minimal && (
        <>
          <path d="M50 9 q9 -4 18 0" fill="none" stroke="#ffd23b" strokeWidth="4" strokeLinecap="round" />
          <circle cx="84" cy="33" r="3.6" fill="#26a7e6" />
        </>
      )}
    </svg>
  );
}
