/** The Male/Female cards at the top of the homepage's "Shop by category" drill-down
 * (CategoryExplorer.tsx) — just the two thumbnail photos, same minimal shape as GenderHeroData. */
export type GenderCardsData = {
  maleImageUrl: string | null;
  femaleImageUrl: string | null;
};

export const DEFAULT_GENDER_CARDS: GenderCardsData = {
  maleImageUrl: null,
  femaleImageUrl: null,
};
