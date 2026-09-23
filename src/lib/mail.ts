import "server-only";
import { db } from "@/lib/db";
import { getEmailTemplates } from "@/lib/store-settings";
import { emailProviderConfigured, sendViaResend } from "@/lib/email-provider";
import type { $Enums } from "@/generated/prisma/client";

/**
 * Every "send" always writes to EmailLog (the outbox, viewable at /admin/emails) as an audit
 * trail. When RESEND_API_KEY + EMAIL_FROM are set, it also actually sends the email; otherwise it
 * stays mocked exactly as before this integration existed, so local dev needs no credentials.
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
  const templates = await getEmailTemplates();
  if (templates[type]?.enabled === false) return null;

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
