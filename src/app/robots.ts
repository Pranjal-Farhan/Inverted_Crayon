import type { MetadataRoute } from "next";

// Deliberately NOT using src/lib/site-url.ts's getSiteOrigin() here — it falls back to
// headers() when SITE_URL isn't set, which would make this whole file a per-request dynamic
// function instead of a cacheable static one. SITE_URL should be set in production (see
// .env.example); this fallback only ever matters in local dev.
const SITE_ORIGIN = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/admin/",
        "/account",
        "/account/",
        "/cart",
        "/checkout",
        "/api/",
        "/search",
        "/order-status",
        "/order/",
        "/track",
      ],
    },
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
  };
}
