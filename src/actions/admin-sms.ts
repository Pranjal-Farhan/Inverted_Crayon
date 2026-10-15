"use server";

import { getAdminForArea } from "@/lib/admin-guard";
import { smsProviderConfigured, sendSmsMessage, normalizeBdMobile } from "@/lib/sms-provider";
import { getStoreInfo } from "@/lib/store-settings";

export type TestSmsResult = { ok: boolean; message: string };

/**
 * Sends one real text through the connected gateway and reports exactly what happened, so the
 * account (token, Sender ID, balance) can be checked end to end before any customer depends on it.
 * Like the test email, it deliberately doesn't go through the outbox: it's a diagnostic, not a
 * message the site "sent". It does cost one SMS from your balance.
 */
export async function sendTestSms(_prev: TestSmsResult | null, formData: FormData): Promise<TestSmsResult> {
  if (!(await getAdminForArea("sms"))) return { ok: false, message: "Not authorized." };

  const to = String(formData.get("to") ?? "").trim();
  const msisdn = normalizeBdMobile(to);
  if (!msisdn) return { ok: false, message: "Enter a Bangladeshi mobile number, like 01712345678." };
  if (!smsProviderConfigured()) {
    return { ok: false, message: "No SMS gateway is connected yet — add the SSL Wireless settings to the server's environment first." };
  }

  const store = await getStoreInfo();
  try {
    const { providerRef } = await sendSmsMessage({
      to: msisdn,
      body: `Test SMS from ${store.name}. If you got this, the site can send texts.`,
      reference: `test-${Date.now()}`,
    });
    return { ok: true, message: `Accepted by the gateway for +${msisdn}${providerRef ? ` (reference ${providerRef})` : ""}. It should arrive in a few seconds.` };
  } catch (e) {
    console.error("test SMS failed", e);
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}
