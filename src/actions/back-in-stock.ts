"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { getCustomerSession } from "@/lib/session";

const schema = z.object({ email: z.email(), variantId: z.string().min(1) });

export async function subscribeBackInStock(
  _prev: { ok: boolean; message: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    variantId: formData.get("variantId"),
  });
  if (!parsed.success) {
    return { ok: false, message: "That didn't go through. Check the fields in red and try again." };
  }
  const session = await getCustomerSession();
  await db.backInStockSubscription.upsert({
    where: { email_variantId: { email: parsed.data.email, variantId: parsed.data.variantId } },
    update: {},
    create: {
      email: parsed.data.email,
      variantId: parsed.data.variantId,
      customerId: session?.customerId,
    },
  });
  return { ok: true, message: "Gone for now. We'll email you the second it's back." };
}
