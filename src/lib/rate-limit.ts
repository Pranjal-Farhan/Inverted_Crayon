import "server-only";
import { headers } from "next/headers";
import { db } from "@/lib/db";

/**
 * Fixed-window rate limits for the public forms and endpoints, counted in Postgres (the RateLimit
 * table) so they hold across every serverless instance. Each rule is a budget of `limit` requests per
 * `windowSec` for one subject — usually the client's IP, sometimes an account or an email address.
 *
 * Limits are deliberately loose: many shoppers in Bangladesh reach the site through a mobile carrier's
 * shared IPs, so these are there to stop scripts (password guessing, coupon probing, mail-bombing
 * through the contact form, fake orders), not to slow down people.
 */
export type RateRule = { name: string; limit: number; windowSec: number };

export const RATE_LIMITS = {
  // Logins: per IP, plus a per-account budget that is counted *before* the password is checked, so a
  // burst of parallel guesses can't all get in ahead of the account lockout. It is reset on success.
  adminLoginIp: { name: "admin-login-ip", limit: 10, windowSec: 15 * 60 },
  adminLoginAccount: { name: "admin-login-account", limit: 6, windowSec: 15 * 60 },
  customerLoginIp: { name: "customer-login-ip", limit: 30, windowSec: 15 * 60 },
  customerLoginAccount: { name: "customer-login-account", limit: 6, windowSec: 15 * 60 },
  register: { name: "register-ip", limit: 10, windowSec: 60 * 60 },
  // Every contact message emails the brand, and an auto-reply goes to the address typed in the form.
  contactIp: { name: "contact-ip", limit: 5, windowSec: 60 * 60 },
  contactRecipient: { name: "contact-recipient", limit: 3, windowSec: 24 * 60 * 60 },
  newsletterIp: { name: "newsletter-ip", limit: 10, windowSec: 60 * 60 },
  backInStockIp: { name: "back-in-stock-ip", limit: 20, windowSec: 60 * 60 },
  couponCheckIp: { name: "coupon-check-ip", limit: 60, windowSec: 10 * 60 },
  placeOrderIp: { name: "place-order-ip", limit: 20, windowSec: 60 * 60 },
  orderLookupIp: { name: "order-lookup-ip", limit: 30, windowSec: 10 * 60 },
} satisfies Record<string, RateRule>;

export const RATE_LIMITED_MESSAGE = "Too many attempts from your network. Please wait a few minutes and try again.";

/**
 * The caller's IP as the hosting edge reports it. On Vercel both headers are set by the edge itself
 * (a client can't supply its own), so they can be trusted there; anywhere without such a proxy they
 * are absent and every caller shares the "unknown" bucket.
 */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const ip = h.get("x-real-ip")?.trim() || h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return ip ? ip.slice(0, 64) : "unknown";
}

/**
 * Counts one request against `rule` for `subject`. Returns false once the subject has used up the
 * window's budget. Fails open: if the counter can't be written, the request goes ahead — a rate limit
 * must never be the thing that takes logins or checkout down.
 */
export async function consumeRateLimit(rule: RateRule, subject: string): Promise<boolean> {
  const key = `${rule.name}:${subject.toLowerCase().slice(0, 200)}`;
  try {
    // One atomic statement: concurrent requests each get their own count, and a window that has
    // ended starts again at 1.
    const rows = await db.$queryRaw<{ count: number }[]>`
      INSERT INTO "RateLimit" ("key", "count", "resetAt")
      VALUES (${key}, 1, now() + (${rule.windowSec}::int * interval '1 second'))
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE WHEN "RateLimit"."resetAt" <= now() THEN 1 ELSE "RateLimit"."count" + 1 END,
        "resetAt" = CASE WHEN "RateLimit"."resetAt" <= now() THEN EXCLUDED."resetAt" ELSE "RateLimit"."resetAt" END
      RETURNING "count"`;
    if (Math.random() < 0.02) void pruneExpired();
    return Number(rows[0]?.count ?? 0) <= rule.limit;
  } catch (e) {
    console.error("[rate-limit] couldn't count a request — letting it through", e);
    return true;
  }
}

/** consumeRateLimit() for the calling client's IP. */
export async function consumeRateLimitForClient(rule: RateRule): Promise<boolean> {
  return consumeRateLimit(rule, await clientIp());
}

/** Gives a subject its full budget back (e.g. an account after a successful login). */
export async function resetRateLimit(rule: RateRule, subject: string): Promise<void> {
  const key = `${rule.name}:${subject.toLowerCase().slice(0, 200)}`;
  await db.rateLimit.deleteMany({ where: { key } }).catch(() => {});
}

async function pruneExpired() {
  await db.rateLimit.deleteMany({ where: { resetAt: { lt: new Date(Date.now() - 60 * 60 * 1000) } } }).catch(() => {});
}
