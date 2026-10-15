import "server-only";
import { db } from "@/lib/db";
import { emailProviderConfigured, sendViaResend } from "@/lib/email-provider";
import type { $Enums } from "@/generated/prisma/client";

/**
 * The low-level email writer. Every "send" always writes to EmailLog (the outbox, viewable at
 * /admin/emails) as an audit trail. When RESEND_API_KEY + EMAIL_FROM are set, it also actually
 * sends the email; otherwise it stays mocked, so local dev needs no credentials.
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
}: {
  to: string;
  subject: string;
  body: string;
  type: $Enums.EmailType;
  relatedOrderId?: string;
}) {
  const log = await db.emailLog.create({
    data: { to, subject, body, type, relatedOrderId },
  });

  if (emailProviderConfigured()) {
    try {
      await sendViaResend({ to, subject, body });
    } catch (e) {
      console.error("real email send failed", e);
    }
  }

  return log;
}
