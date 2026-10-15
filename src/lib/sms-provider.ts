import "server-only";

/**
 * Real SMS delivery via SSL Wireless's SMS Plus API (a Bangladeshi gateway, same corporate group as
 * SSLCommerz). Credentials live only in the server's environment — nothing is stored in the database:
 *
 *  - SSLWIRELESS_SMS_API_TOKEN — the API token from your SMS Plus account
 *  - SSLWIRELESS_SMS_SID       — your approved Sender ID (the name/number a text appears to come from)
 *  - SSLWIRELESS_SMS_BASE_URL  — optional; only to point at a different endpoint (or a test server)
 *
 * With either of the first two missing, `smsProviderConfigured()` is false and sendSms() only writes
 * to the SmsLog outbox, so local development needs no gateway account — the same pattern as
 * email-provider.ts.
 */
export type SmsProviderName = "sslwireless";

const env = (name: string) => process.env[name]?.trim() || undefined;
const baseUrl = () => (env("SSLWIRELESS_SMS_BASE_URL") ?? "https://smsplus.sslwireless.com/api/v3").replace(/\/$/, "");

/** How long we wait for the gateway before giving up — a text must never hang a checkout. */
const SEND_TIMEOUT_MS = 10_000;

export function smsProvider(): SmsProviderName | null {
  return env("SSLWIRELESS_SMS_API_TOKEN") && env("SSLWIRELESS_SMS_SID") ? "sslwireless" : null;
}

export function smsProviderConfigured(): boolean {
  return smsProvider() !== null;
}

/** A non-secret summary for the admin screen: what's connected, and as whom. */
export function describeSmsProvider(): { provider: SmsProviderName | null; senderId: string | null; host: string | null } {
  const provider = smsProvider();
  if (!provider) return { provider: null, senderId: null, host: null };
  let host: string | null = null;
  try {
    host = new URL(baseUrl()).host;
  } catch {
    host = baseUrl();
  }
  return { provider, senderId: env("SSLWIRELESS_SMS_SID") ?? null, host };
}

/**
 * A Bangladeshi mobile number in the 8801XXXXXXXXX form the gateway wants, or null if it isn't one.
 * Accepts the ways people actually type them: 01712-345678, +880 1712 345678, 8801712345678,
 * 1712345678. Mobile numbers are 01[3-9] followed by 8 digits.
 */
export function normalizeBdMobile(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  const m = /^(?:880|0)?(1[3-9]\d{8})$/.exec(digits);
  return m ? `880${m[1]}` : null;
}

type GatewayReply = {
  status?: string;
  status_code?: number | string;
  error_message?: string;
  message?: string;
  smsinfo?: { sms_status?: string; status_message?: string; sms_id?: string | number; reference_id?: string | number }[];
};

/**
 * Sends one text and returns the gateway's own reference for it, if it gave one. Throws — with the
 * gateway's own wording where there is some — on anything short of "accepted": an unusable number,
 * no answer in time, a refusal, or an unreadable reply. `reference` is our own id for the message
 * (the outbox row's id), so a message can be matched up on the gateway's side too.
 */
export async function sendSmsMessage(params: { to: string; body: string; reference: string }): Promise<{ providerRef: string | null }> {
  if (!smsProviderConfigured()) throw new Error("No SMS gateway is connected.");

  const msisdn = normalizeBdMobile(params.to);
  if (!msisdn) throw new Error(`"${params.to}" isn't a valid Bangladeshi mobile number (expected something like 01712345678).`);

  let res: Response;
  try {
    res = await fetch(`${baseUrl()}/send-sms`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        api_token: env("SSLWIRELESS_SMS_API_TOKEN"),
        sid: env("SSLWIRELESS_SMS_SID"),
        msisdn,
        sms: params.body,
        csms_id: params.reference,
      }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (e) {
    if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) {
      throw new Error(`The SMS gateway didn't answer within ${SEND_TIMEOUT_MS / 1000} seconds.`);
    }
    const cause = e instanceof Error && e.cause instanceof Error ? ` (${e.cause.message})` : "";
    throw new Error(`Couldn't reach the SMS gateway at ${describeSmsProvider().host}${cause} — check SSLWIRELESS_SMS_BASE_URL and the server's network access.`);
  }

  const text = await res.text().catch(() => "");
  let data: GatewayReply = {};
  try {
    data = JSON.parse(text) as GatewayReply;
  } catch {
    // not JSON — handled below, using the raw text
  }
  const info = Array.isArray(data.smsinfo) ? data.smsinfo[0] : undefined;

  // The gateway can answer HTTP 200 and still refuse the message, so look at what it says it did.
  const topOk = data.status === undefined ? res.ok : String(data.status).toUpperCase() === "SUCCESS";
  const messageOk = !info?.sms_status || String(info.sms_status).toUpperCase() === "SUCCESS";
  if (res.ok && topOk && messageOk && (data.status !== undefined || info)) {
    const ref = info?.sms_id ?? info?.reference_id;
    return { providerRef: ref !== undefined && ref !== null ? String(ref) : null };
  }

  if (res.ok && topOk && messageOk) {
    // A success status code but nothing we can read as "accepted" — say so rather than guess.
    throw new Error(`The SMS gateway's reply wasn't understood, so it's unknown whether the message went out (HTTP ${res.status}): ${text.slice(0, 200) || "empty reply"}`);
  }

  const reason =
    data.error_message || info?.status_message || data.message || (text ? text.slice(0, 200) : "") || `HTTP ${res.status}`;
  const hint =
    res.status === 401 || res.status === 403
      ? " — the API token or Sender ID was refused; check SSLWIRELESS_SMS_API_TOKEN and SSLWIRELESS_SMS_SID."
      : "";
  throw new Error(`SSL Wireless refused the message: ${reason} (HTTP ${res.status})${hint}`);
}
