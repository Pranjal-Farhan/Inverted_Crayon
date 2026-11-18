"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { notifyContactMessage } from "@/lib/notifications";
import { RATE_LIMITED_MESSAGE, RATE_LIMITS, consumeRateLimit, consumeRateLimitForClient } from "@/lib/rate-limit";

const schema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.email().max(254),
  message: z.string().trim().min(5).max(5000),
});

export async function sendContactMessage(
  _prev: { ok: boolean; message: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  if (!(await consumeRateLimitForClient(RATE_LIMITS.contactIp))) {
    return { ok: false, message: RATE_LIMITED_MESSAGE };
  }
  const parsed = schema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    message: formData.get("message"),
  });
  if (!parsed.success) {
    return { ok: false, message: "That didn't go through. Check the fields in red and try again." };
  }
  try {
    await db.contactMessage.create({ data: parsed.data });
  } catch (e) {
    console.error("sendContactMessage failed", e);
    return { ok: false, message: "That didn't go through. Please try again in a moment." };
  }
  // Forward the message to the brand's own inbox, and acknowledge to the sender — but only a few
  // acknowledgements a day per address: that email goes to whatever address was typed into a public
  // form, so without a cap the form could be used to flood someone's inbox with mail from the brand.
  const acknowledge = await consumeRateLimit(RATE_LIMITS.contactRecipient, parsed.data.email);
  await notifyContactMessage(parsed.data, { acknowledge });
  return { ok: true, message: "Got it — we'll reply within 1–2 business days." };
}
