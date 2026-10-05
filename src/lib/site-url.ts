import "server-only";
import { headers } from "next/headers";

/**
 * Hardcoded production domain — the last-resort fallback for the two files (robots.ts,
 * sitemap.ts) that deliberately avoid headers()/getSiteOrigin() so they can stay static. If
 * SITE_URL is unset in production, a crawler would otherwise be served localhost URLs, which
 * both looks broken and tells search engines nothing useful.
 *
 * This is only a fallback for the case SITE_URL is missed — SITE_URL must still be set in
 * Vercel (see .env.example) so getSiteOrigin() (payment-gateway callback links) and this
 * constant agree on the same origin.
 */
export const PRODUCTION_SITE_URL = "https://invertedcrayon.vercel.app";

/** Base URL for building payment-gateway callback links. Prefer an explicit SITE_URL in production. */
export async function getSiteOrigin(): Promise<string> {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
