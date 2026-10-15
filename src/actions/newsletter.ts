"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { notifyNewsletterSignup } from "@/lib/notifications";

const schema = z.email();

export async function subscribeNewsletter(
  _prev: { ok: boolean; message: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
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
