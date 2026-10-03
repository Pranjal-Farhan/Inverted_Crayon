/** The editorial banner atop /men and /women (GenderHub.tsx) — much simpler than the homepage
 * hero (no headline/carousel, just one photo): the page's own title/eyebrow text already sits
 * above it, so this is purely the background image behind the "Shop {label}" button. */
export type GenderHeroData = {
  imageUrl: string | null;
};

export const DEFAULT_GENDER_HERO: GenderHeroData = {
  imageUrl: null,
};
