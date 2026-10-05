import type { MetadataRoute } from "next";
import { PRODUCTION_SITE_URL } from "@/lib/site-url";

// Deliberately NOT using src/lib/site-url.ts's getSiteOrigin() here — it falls back to
// headers() when SITE_URL isn't set, which would make this whole file a per-request dynamic
// function instead of a cacheable static one. SITE_URL should be set in production (see
// .env.example); if it's ever missed, fall back to the real production domain rather than
// localhost — this file has no request to read headers from, so localhost would otherwise leak
// into a live robots.txt's sitemap link.
const SITE_ORIGIN = (process.env.SITE_URL ?? PRODUCTION_SITE_URL).replace(/\/$/, "");

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
