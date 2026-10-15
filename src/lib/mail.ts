import "server-only";
import { db } from "@/lib/db";
import { emailProviderConfigured, sendEmail } from "@/lib/email-provider";
import { getStoreInfo } from "@/lib/store-settings";
import type { $Enums } from "@/generated/prisma/client";

/**
 * The low-level email writer. Every "send" always writes to EmailLog (the outbox, viewable at
 * /admin/emails) as an audit trail. When an email provider is connected (SMTP, or Resend — see
 * email-provider.ts) it also actually sends the email and records the outcome on the row:
 * SENT, or FAILED with the provider's own error. Without one it stays mocked (LOGGED), so local dev
 * needs no credentials.
 *
 * Call sites don't use this directly — they go through sendTemplatedEmail (src/lib/messages.ts),
 * which applies the admin-editable body, the on/off switch, and the right recipient.
 */
export async function sendMail({
  to,
  subject,
  body,
  type,
  relatedOrderId,
  replyToStore = false,
}: {
  to: string;
  subject: string;
  body: string;
  type: $Enums.EmailType;
  relatedOrderId?: string;
  /** Point replies at the brand's official address (customer-facing emails). */
  replyToStore?: boolean;
}) {
  const log = await db.emailLog.create({
    data: { to, subject, body, type, relatedOrderId },
  });

  if (!emailProviderConfigured()) return log;

  try {
    const store = await getStoreInfo();
    await sendEmail({ to, subject, body, storeName: store.name, replyTo: replyToStore ? store.email : undefined });
    return await db.emailLog.update({ where: { id: log.id }, data: { delivery: "SENT" } });
  } catch (e) {
    // An email provider hiccup must never break the checkout/signup/admin action that triggered it —
    // the failure is kept on the outbox row, where the admin can see it.
    console.error("real email send failed", e);
    const message = e instanceof Error ? e.message : String(e);
    return await db.emailLog
      .update({ where: { id: log.id }, data: { delivery: "FAILED", deliveryError: message.slice(0, 500) } })
      .catch(() => log);
  }
}
