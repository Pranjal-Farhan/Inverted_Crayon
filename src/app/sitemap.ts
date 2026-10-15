import type { MetadataRoute } from "next";
import { getAllActiveProductSlugs } from "@/lib/get-product";
import { getNavCategories } from "@/lib/public-cache";
import { PRODUCTION_SITE_URL } from "@/lib/site-url";

// Same reasoning as robots.ts for not using getSiteOrigin() (avoids a headers() call that would
// make this dynamic) and for falling back to the real production domain rather than localhost.
// Safety-net revalidation on top of the tag-based invalidation the underlying cached reads
// already have.
const SITE_ORIGIN = (process.env.SITE_URL ?? PRODUCTION_SITE_URL).replace(/\/$/, "");
export const revalidate = 3600;

const STATIC_PATHS = [
  "/",
  "/men",
  "/women",
  "/new",
  "/sale",
  "/lookbook",
  "/faq",
  "/contact",
  "/privacy",
  "/terms",
  "/size-guide",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [productSlugs, categories] = await Promise.all([
    getAllActiveProductSlugs(),
    getNavCategories(),
  ]);

  const entries: MetadataRoute.Sitemap = STATIC_PATHS.map((path) => ({
    url: `${SITE_ORIGIN}${path}`,
    changeFrequency: path === "/" ? "daily" : "weekly",
    priority: path === "/" ? 1 : 0.6,
  }));

  for (const slug of productSlugs) {
    entries.push({ url: `${SITE_ORIGIN}/product/${slug}`, changeFrequency: "daily", priority: 0.8 });
  }
  for (const c of categories.men) {
    entries.push({ url: `${SITE_ORIGIN}/men/${c.slug}`, changeFrequency: "weekly", priority: 0.7 });
  }
  for (const c of categories.women) {
    entries.push({ url: `${SITE_ORIGIN}/women/${c.slug}`, changeFrequency: "weekly", priority: 0.7 });
  }

  return entries;
}
