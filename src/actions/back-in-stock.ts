"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { getCustomerSession } from "@/lib/session";
import { notifyNotifyMeSignup } from "@/lib/notifications";
import { RATE_LIMITED_MESSAGE, RATE_LIMITS, consumeRateLimitForClient } from "@/lib/rate-limit";

const schema = z.object({ email: z.email().max(254), variantId: z.string().min(1).max(64) });

export async function subscribeBackInStock(
  _prev: { ok: boolean; message: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  if (!(await consumeRateLimitForClient(RATE_LIMITS.backInStockIp))) {
    return { ok: false, message: RATE_LIMITED_MESSAGE };
  }
  const parsed = schema.safeParse({
    email: formData.get("email"),
    variantId: formData.get("variantId"),
  });
  if (!parsed.success) {
    return { ok: false, message: "That didn't go through. Check the fields in red and try again." };
  }
  // A size of a product that's actually on sale (not a draft, not deleted) — anything else is refused
  // here rather than failing on the foreign key below.
  const variant = await db.variant.findFirst({ where: { id: parsed.data.variantId, product: { status: "ACTIVE" } }, select: { id: true } });
  if (!variant) {
    return { ok: false, message: "That size isn't available any more." };
  }
  const session = await getCustomerSession();
  const key = { email_variantId: { email: parsed.data.email, variantId: parsed.data.variantId } };
  // Only a genuinely new sign-up is worth telling the brand about — pressing the button twice isn't.
  const alreadySubscribed = await db.backInStockSubscription.findUnique({ where: key });
  await db.backInStockSubscription.upsert({
    where: key,
    update: {},
    create: {
      email: parsed.data.email,
      variantId: parsed.data.variantId,
      customerId: session?.customerId,
    },
  });
  if (!alreadySubscribed) {
    await notifyNotifyMeSignup({ email: parsed.data.email, variantId: parsed.data.variantId, hasAccount: Boolean(session?.customerId) });
  }
  return { ok: true, message: "Gone for now. We'll email you the second it's back." };
}
