/**
 * The 8 shared categories. Both Men and Women expose the same set — gender
 * is a context/filter carried through the URL, not a separate category
 * tree (Build Spec §00 locked decision, §06). Slugs match Category.slug
 * seeded in the database.
 */
export const CATEGORIES = [
  { slug: "shirts", name: "Shirts" },
  { slug: "tees", name: "Tees" },
  { slug: "jeans", name: "Jeans" },
  { slug: "trousers", name: "Trousers" },
  { slug: "hoodies", name: "Hoodies" },
  { slug: "outerwear", name: "Outerwear" },
  { slug: "headwear", name: "Headwear" },
  { slug: "accessories", name: "Accessories" },
] as const;

export type CategorySlug = (typeof CATEGORIES)[number]["slug"];
