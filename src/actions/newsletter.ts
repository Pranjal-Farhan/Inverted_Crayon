"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { notifyNewsletterSignup } from "@/lib/notifications";
import { RATE_LIMITED_MESSAGE, RATE_LIMITS, consumeRateLimitForClient } from "@/lib/rate-limit";

// Lowercased, so "Me@x.com" and "me@x.com" are one subscriber (and get one welcome email).
const schema = z.email().max(254).transform((e) => e.toLowerCase());

export async function subscribeNewsletter(
  _prev: { ok: boolean; message: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  // Each new address gets a welcome email, so this is capped per client like the other public forms.
  if (!(await consumeRateLimitForClient(RATE_LIMITS.newsletterIp))) {
    return { ok: false, message: RATE_LIMITED_MESSAGE };
  }
  const parsed = schema.safeParse(formData.get("email"));
  if (!parsed.success) {
    return { ok: false, message: "That didn't go through. Check the fields in red and try again." };
  }
  try {
    const existing = await db.newsletterSubscriber.findUnique({ where: { email: parsed.data } });
    if (!existing) {
      await db.newsletterSubscriber.create({ data: { email: parsed.data } });
      await notifyNewsletterSignup(parsed.data);
    }
  } catch (e) {
    console.error("subscribeNewsletter failed", e);
    return { ok: false, message: "That didn't go through. Please try again in a moment." };
  }
  return { ok: true, message: "Stay inverted. You're in." };
}
