import "server-only";
import { db } from "@/lib/db";
import { sendMail } from "@/lib/mail";
import type { EmailAttachment } from "@/lib/email-provider";
import { sendSms } from "@/lib/sms";
import { getSiteOrigin, PRODUCTION_SITE_URL } from "@/lib/site-url";
import { getStoreInfo, type StoreInfo } from "@/lib/store-settings";
import {
  TEMPLATES,
  TEMPLATE_BY_KEY,
  emailTypeFor,
  renderTemplate,
  smsTypeFor,
  type TemplateKey,
} from "@/lib/message-templates";
import type { $Enums } from "@/generated/prisma/client";

/**
 * How message templates are stored and sent. Admin edits live in the `message_templates`
 * StoreSetting as `{ [key]: { body?, enabled? } }` — only what was changed; anything absent falls
 * back to the default in the catalog, so a template the admin never touched keeps following the
 * code's wording. Sending never throws: a failed email or SMS must not break the order, signup or
 * admin action that triggered it (the failure is logged, and the outbox row is written first).
 */

export const MESSAGE_TEMPLATES_SETTING = "message_templates";
const LEGACY_EMAIL_TEMPLATES_SETTING = "email_templates";

export type TemplateConfig = { body: string; enabled: boolean };
type StoredConfig = { body?: string; enabled?: boolean };

type EmailTemplateKey = Exclude<TemplateKey, `SMS_${string}`>;
type SmsTemplateKey = Extract<TemplateKey, `SMS_${string}`>;

export async function getTemplateConfigs(): Promise<Record<TemplateKey, TemplateConfig>> {
  const [row, legacyRow] = await Promise.all([
    db.storeSetting.findUnique({ where: { key: MESSAGE_TEMPLATES_SETTING } }),
    db.storeSetting.findUnique({ where: { key: LEGACY_EMAIL_TEMPLATES_SETTING } }),
  ]);
  const stored = (row?.value ?? {}) as Partial<Record<TemplateKey, StoredConfig>>;
  // The old Settings → Emails tab kept an on/off flag per email type; honour it until the admin
  // saves that template here, so nothing they'd switched off starts sending again.
  const legacy = (legacyRow?.value ?? {}) as Record<string, { enabled?: boolean } | undefined>;

  return Object.fromEntries(
    TEMPLATES.map((t) => {
      const s = stored[t.key];
      const body = typeof s?.body === "string" && s.body.trim() !== "" ? s.body : t.defaultBody;
      const enabled = s?.enabled ?? legacy[t.key]?.enabled ?? true;
      return [t.key, { body, enabled }];
    }),
  ) as Record<TemplateKey, TemplateConfig>;
}

export async function getTemplateConfig(key: TemplateKey): Promise<TemplateConfig> {
  return (await getTemplateConfigs())[key];
}

/** The store's details and the site's own address — what message variables are built against. */
export async function getMessageContext(): Promise<{ store: StoreInfo; origin: string }> {
  const store = await getStoreInfo();
  let origin = PRODUCTION_SITE_URL;
  try {
    origin = await getSiteOrigin();
  } catch {
    // no request context (a script or background job) — the production address is the right fallback
  }
  return { store, origin };
}

/** The store-wide placeholders every message gets for free. */
async function baseVars(): Promise<Record<string, string>> {
  const { store, origin } = await getMessageContext();
  return { storeName: store.name, storeEmail: store.email, storePhone: store.phone, siteUrl: origin };
}

const looksLikeEmail = (s: string) => /^\S+@\S+\.\S+$/.test(s);

/**
 * Sends one email from its template. `to` is the customer's address for CUSTOMER templates; BRAND
 * templates ignore it and go to the official address in Settings → Store. Returns the outbox row,
 * or null when the template is switched off or there's nobody to send to.
 */
export async function sendTemplatedEmail({
  key,
  to,
  vars,
  relatedOrderId,
  attachments,
}: {
  key: EmailTemplateKey;
  to?: string;
  vars: Record<string, string>;
  relatedOrderId?: string;
  /** Files to attach — the PDF receipt on order emails (see notifications.ts). */
  attachments?: EmailAttachment[];
}) {
  try {
    const def = TEMPLATE_BY_KEY[key];
    const config = await getTemplateConfig(key);
    if (!config.enabled) return null;

    const allVars = { ...(await baseVars()), ...vars };
    const recipient = def.audience === "BRAND" ? allVars.storeEmail : to;
    if (!recipient || !looksLikeEmail(recipient)) {
      console.warn(`[messages] ${key}: no valid recipient address — not sent`);
      return null;
    }

    return await sendMail({
      to: recipient,
      subject: renderTemplate(def.subject ?? def.title, allVars),
      body: renderTemplate(config.body, allVars),
      type: emailTypeFor(key) as $Enums.EmailType,
      relatedOrderId,
      // A customer who replies to an order email should reach the brand's official mailbox.
      replyToStore: def.audience === "CUSTOMER",
      attachments,
    });
  } catch (e) {
    console.error(`[messages] sending ${key} failed`, e);
    return null;
  }
}

/** The SMS counterpart: renders the template and sends it to the customer's phone. */
export async function sendTemplatedSms({
  key,
  to,
  vars,
  relatedOrderId,
}: {
  key: SmsTemplateKey;
  to: string | null | undefined;
  vars: Record<string, string>;
  relatedOrderId?: string;
}) {
  try {
    if (!to || to.replace(/\D/g, "").length < 6) return null;
    const config = await getTemplateConfig(key);
    if (!config.enabled) return null;

    const allVars = { ...(await baseVars()), ...vars };
    return await sendSms({
      to,
      body: renderTemplate(config.body, allVars),
      type: smsTypeFor(key) as $Enums.SmsType,
      relatedOrderId,
    });
  } catch (e) {
    console.error(`[messages] sending ${key} failed`, e);
    return null;
  }
}
