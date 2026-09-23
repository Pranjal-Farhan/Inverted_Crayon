import "server-only";
import { db } from "@/lib/db";
import { getEmailTemplates } from "@/lib/store-settings";
import type { $Enums } from "@/generated/prisma/client";

/**
 * Payments are mocked per the build's stated scope; email sending is mocked
 * the same way — every "send" writes to EmailLog (the outbox) instead of
 * calling a real provider. Wiring SendGrid/SES/etc. later means replacing
 * the body of this one function; every call site stays the same.
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

  return db.emailLog.create({
    data: { to, subject, body, type, relatedOrderId },
  });
}
