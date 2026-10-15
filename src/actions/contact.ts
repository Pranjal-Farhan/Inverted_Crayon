"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { notifyContactMessage } from "@/lib/notifications";

const schema = z.object({
  name: z.string().min(1),
  email: z.email(),
  message: z.string().min(5),
});

export async function sendContactMessage(
  _prev: { ok: boolean; message: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
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
  // Acknowledge to the sender, and forward the message to the brand's own inbox.
  await notifyContactMessage(parsed.data);
  return { ok: true, message: "Got it — we'll reply within 1–2 business days." };
}
