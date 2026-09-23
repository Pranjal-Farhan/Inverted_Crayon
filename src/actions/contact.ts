"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { sendMail } from "@/lib/mail";

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
  await db.contactMessage.create({ data: parsed.data });
  await sendMail({
    to: parsed.data.email,
    subject: "We got your message",
    body: `Hey ${parsed.data.name} — we got it and will reply within 1–2 business days.`,
    type: "CONTACT_RECEIVED",
  });
  return { ok: true, message: "Got it — we'll reply within 1–2 business days." };
}
