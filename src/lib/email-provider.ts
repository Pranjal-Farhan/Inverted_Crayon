import "server-only";

/**
 * Real email delivery via Resend's REST API (no SDK dependency needed — one fetch call). Needs
 * RESEND_API_KEY and EMAIL_FROM (a verified sender on your Resend account) to do anything; when
 * unset, `emailProviderConfigured()` is false and `sendMail()` falls back to writing only to the
 * EmailLog outbox, exactly as before this integration existed.
 */
export function emailProviderConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export async function sendViaResend(params: { to: string; subject: string; body: string }): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: params.to,
      subject: params.subject,
      text: params.body,
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Resend send failed: ${res.status} ${errText}`);
  }
}
