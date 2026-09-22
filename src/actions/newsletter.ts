"use server";

import { z } from "zod";
import { db } from "@/lib/db";

const schema = z.email();

export async function subscribeNewsletter(
  _prev: { ok: boolean; message: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  const parsed = schema.safeParse(formData.get("email"));
  if (!parsed.success) {
    return { ok: false, message: "That didn't go through. Check the fields in red and try again." };
  }
  await db.newsletterSubscriber.upsert({
    where: { email: parsed.data },
    update: {},
    create: { email: parsed.data },
  });
  return { ok: true, message: "Stay inverted. You're in." };
}
