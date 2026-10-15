import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

/**
 * Real email delivery. Two providers, picked by which environment variables are set (nothing is
 * stored in the database — credentials live only in the server's environment):
 *
 *  - SMTP — the brand's own mailbox. Works with a Gmail/Google Workspace address (smtp.gmail.com,
 *    using an "app password") or any domain mailbox (cPanel, Zoho, Outlook…). Needs SMTP_HOST,
 *    SMTP_USER and SMTP_PASS; SMTP_PORT defaults to 465 (SSL). Mail goes out *as* that mailbox, so
 *    it lands in the Sent folder and replies come straight back to it.
 *  - Resend — an API service that needs a verified sending *domain* (it cannot send from a
 *    @gmail.com address). Needs RESEND_API_KEY and EMAIL_FROM.
 *
 * SMTP wins if both are set. With neither, `emailProviderConfigured()` is false and sendMail()
 * only writes to the EmailLog outbox, so local development needs no credentials.
 */
export type EmailProviderName = "smtp" | "resend";

const env = (name: string) => process.env[name]?.trim() || undefined;

export function emailProvider(): EmailProviderName | null {
  if (env("SMTP_HOST") && env("SMTP_USER") && env("SMTP_PASS")) return "smtp";
  if (env("RESEND_API_KEY") && env("EMAIL_FROM")) return "resend";
  return null;
}

export function emailProviderConfigured(): boolean {
  return emailProvider() !== null;
}

/** "Inverted Crayon <hello@…>" — EMAIL_FROM if set, else the SMTP mailbox itself under the store's name. */
export function emailFrom(storeName: string): string | null {
  const explicit = env("EMAIL_FROM");
  if (explicit) return explicit;
  const user = env("SMTP_USER");
  return user && emailProvider() === "smtp" ? `"${storeName.replace(/"/g, "")}" <${user}>` : null;
}

/** A non-secret summary for the admin screen: what's connected, and as whom. */
export function describeEmailProvider(storeName: string): {
  provider: EmailProviderName | null;
  from: string | null;
  host: string | null;
} {
  const provider = emailProvider();
  return {
    provider,
    from: provider ? emailFrom(storeName) : null,
    host: provider === "smtp" ? (env("SMTP_HOST") ?? null) : provider === "resend" ? "api.resend.com" : null,
  };
}

let transport: Transporter | null = null;

function smtpTransport(): Transporter {
  if (transport) return transport;
  const port = Number(env("SMTP_PORT") ?? 465);
  // 465 is implicit SSL; anything else (587, 25) starts plain and upgrades with STARTTLS.
  const secure = env("SMTP_SECURE") ? env("SMTP_SECURE") === "true" : port === 465;
  transport = nodemailer.createTransport({
    host: env("SMTP_HOST"),
    port,
    secure,
    auth: { user: env("SMTP_USER"), pass: env("SMTP_PASS") },
    // nodemailer's defaults wait minutes on a dead host — long enough to hang a checkout. A message
    // that can't be handed over in this time is recorded as failed instead.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  return transport;
}

export type OutgoingEmail = {
  to: string;
  subject: string;
  body: string;
  /** Used only when EMAIL_FROM isn't set (SMTP): the display name shown next to the mailbox. */
  storeName: string;
  /** Where a customer's reply should go — the brand's official address. */
  replyTo?: string;
};

/** Sends one plain-text email through whichever provider is configured. Throws on any failure. */
export async function sendEmail(mail: OutgoingEmail): Promise<void> {
  const provider = emailProvider();
  const from = emailFrom(mail.storeName);
  if (!provider || !from) throw new Error("No email provider is connected.");

  if (provider === "smtp") {
    await smtpTransport().sendMail({
      from,
      to: mail.to,
      subject: mail.subject,
      text: mail.body,
      replyTo: mail.replyTo,
    });
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: mail.to,
      subject: mail.subject,
      text: mail.body,
      ...(mail.replyTo ? { reply_to: mail.replyTo } : {}),
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Resend send failed: ${res.status} ${errText}`);
  }
}
