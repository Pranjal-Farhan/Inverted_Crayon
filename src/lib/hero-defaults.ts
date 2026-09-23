export type HeroData = {
  eyebrow: string;
  headline: string;
  sub: string;
  subBold: string;
  badge: string;
  brandName: string;
  motto: string;
  logoImageUrl: string | null;
  heroImages: string[];
  backgroundColor: string | null;
};

export const DEFAULT_HERO: HeroData = {
  eyebrow: "Color outside the norm.",
  headline: "Invert the ordinary.",
  sub: "Streetwear made for disruptors.",
  subBold: "Bold. Unfiltered. Inverted.",
  badge: "New drop live now",
  brandName: "Inverted Crayon",
  motto: "Stay Inverted",
  logoImageUrl: null,
  heroImages: [],
  backgroundColor: null,
};
