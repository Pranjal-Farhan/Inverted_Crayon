import Image from "next/image";
import { pickAccent } from "@/lib/accent-color";

/**
 * Customer avatar — the real photo when one's on file (currently only ever set by Google OAuth,
 * see googleExchangeCode in src/lib/oauth/google.ts), otherwise a colored circle with the first
 * letter of their name (or email, for the rare account with no name on file). Color is hashed
 * from their own identity (same convention as pickAccent elsewhere), so the same person always
 * gets the same fallback color across the site.
 */
export function Avatar({
  src,
  name,
  email,
  size = 40,
  className = "",
}: {
  src?: string | null;
  name?: string | null;
  email?: string | null;
  size?: number;
  className?: string;
}) {
  if (src) {
    return (
      <Image
        src={src}
        alt={name ? `${name}'s avatar` : "Avatar"}
        width={size}
        height={size}
        className={`rounded-full object-cover ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  const letter = (name?.trim()?.[0] ?? email?.trim()?.[0] ?? "?").toUpperCase();
  const accent = pickAccent(email ?? name ?? "avatar");

  return (
    <span
      role="img"
      aria-label={name ? `${name}'s avatar` : "Avatar"}
      className={`font-label inline-flex shrink-0 items-center justify-center rounded-full font-bold text-ink ${className}`}
      style={{ width: size, height: size, backgroundColor: accent.color, fontSize: size * 0.42 }}
    >
      {letter}
    </span>
  );
}
