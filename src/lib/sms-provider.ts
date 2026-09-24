import "server-only";

/**
 * Real SMS delivery via SSL Wireless's SMS Plus API — chosen to sit alongside SSLCommerz (same
 * corporate group), a Bangladeshi gateway that fits this store's other integrations. Needs
 * SSLWIRELESS_SMS_API_TOKEN and SSLWIRELESS_SMS_SID (your approved Sender ID) to do anything; when
 * unset, `smsProviderConfigured()` is false and `sendSms()` falls back to writing only to the
 * SmsLog outbox, same pattern as `email-provider.ts`.
 */

const BASE_URL = process.env.SSLWIRELESS_SMS_BASE_URL || "https://smsplus.sslwireless.com/api/v3";

export function smsProviderConfigured(): boolean {
  return Boolean(process.env.SSLWIRELESS_SMS_API_TOKEN && process.env.SSLWIRELESS_SMS_SID);
}

/** Strips everything but digits and normalizes to the 880XXXXXXXXXX form the gateway expects. */
function toMsisdn(phone: string): string {
  let digits = phone.replace(/[^0-9]/g, "");
  if (digits.startsWith("880")) return digits;
  if (digits.startsWith("0")) digits = digits.slice(1);
  return `880${digits}`;
}

export async function sendViaSslWireless(params: { to: string; body: string; csmsId: string }): Promise<void> {
  const res = await fetch(`${BASE_URL}/send-sms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_token: process.env.SSLWIRELESS_SMS_API_TOKEN,
      sid: process.env.SSLWIRELESS_SMS_SID,
      msisdn: toMsisdn(params.to),
      sms: params.body,
      csms_id: params.csmsId,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || (data.status && data.status !== "SUCCESS")) {
    throw new Error(`SSL Wireless SMS send failed: ${res.status} ${JSON.stringify(data)}`);
  }
}
