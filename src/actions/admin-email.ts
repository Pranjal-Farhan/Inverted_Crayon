"use server";

import { getAdminForArea } from "@/lib/admin-guard";
import { emailProviderConfigured, sendEmail } from "@/lib/email-provider";
import { getStoreInfo } from "@/lib/store-settings";

export type TestEmailResult = { ok: boolean; message: string };

/** Turns a mail-server error into something an admin can act on, keeping the server's own words. */
function explain(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  const code = (e as { code?: string } | null)?.code;
  if (code === "EAUTH") {
    return `The mail server rejected the username or password. For Gmail this must be a 16-character app password, not the account's normal password. (${raw})`;
  }
  if (code === "ESOCKET" || code === "ECONNECTION" || code === "ETIMEDOUT" || code === "ECONNREFUSED" || code === "ENOTFOUND" || code === "EDNS") {
    return `Couldn't reach the mail server — check SMTP_HOST and SMTP_PORT. (${raw})`;
  }
  return raw;
}

/**
 * Sends one real email through the connected provider and reports exactly what happened, so the
 * brand's mailbox can be checked end to end before any customer depends on it. It deliberately
 * doesn't go through the outbox: it's a diagnostic, not a message the site "sent".
 */
export async function sendTestEmail(_prev: TestEmailResult | null, formData: FormData): Promise<TestEmailResult> {
  if (!(await getAdminForArea("emails"))) return { ok: false, message: "Not authorized." };

  const to = String(formData.get("to") ?? "").trim();
  if (!/^\S+@\S+\.\S+$/.test(to)) return { ok: false, message: "Enter a valid email address." };
  if (!emailProviderConfigured()) {
    return {
      ok: false,
      message: "No email provider is connected yet — add the SMTP settings to the server's environment first.",
    };
  }

  const store = await getStoreInfo();
  try {
    await sendEmail({
      to,
      subject: `Test email from ${store.name}`,
      body: `This is a test email from the ${store.name} admin.\n\nIf you're reading it, the site can send email as ${store.email}.`,
      storeName: store.name,
      replyTo: store.email,
    });
    return { ok: true, message: `Sent to ${to}. Check that inbox (and its spam folder).` };
  } catch (e) {
    console.error("test email failed", e);
    return { ok: false, message: explain(e) };
  }
}
