"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdminArea } from "@/lib/admin-guard";
import { MESSAGE_TEMPLATES_SETTING } from "@/lib/messages";
import {
  MAX_BODY_LENGTH,
  TEMPLATE_BY_KEY,
  findUnknownPlaceholders,
  type TemplateKey,
} from "@/lib/message-templates";

async function requireAdmin() {
  return requireAdminArea("templates");
}

type StoredConfig = { body?: string; enabled?: boolean };
type Stored = Partial<Record<TemplateKey, StoredConfig>>;

async function readStored(): Promise<Stored> {
  const row = await db.storeSetting.findUnique({ where: { key: MESSAGE_TEMPLATES_SETTING } });
  return (row?.value ?? {}) as Stored;
}

async function writeStored(value: Stored) {
  await db.storeSetting.upsert({
    where: { key: MESSAGE_TEMPLATES_SETTING },
    update: { value },
    create: { key: MESSAGE_TEMPLATES_SETTING, value },
  });
  revalidatePath("/admin/templates");
}

export type TemplateResult = { ok: true } | { ok: false; error: string };

const saveSchema = z.object({ key: z.string(), body: z.string(), enabled: z.boolean() });

/** Saves a template's message text and on/off switch. Only the body is editable — subjects and who
 * a message goes to are fixed in code — and every {placeholder} has to be one this message offers. */
export async function saveMessageTemplate(input: { key: string; body: string; enabled: boolean }): Promise<TemplateResult> {
  await requireAdmin();
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That didn't go through. Try again." };

  const def = TEMPLATE_BY_KEY[parsed.data.key as TemplateKey];
  if (!def) return { ok: false, error: "That message doesn't exist." };

  const body = parsed.data.body.replace(/\r\n/g, "\n").trim();
  if (!body) {
    return { ok: false, error: "The message can't be empty. Use “Reset to default” to go back to the original, or switch it off." };
  }
  const max = MAX_BODY_LENGTH[def.channel];
  if (body.length > max) {
    return { ok: false, error: `That's ${body.length} characters — the limit for ${def.channel === "SMS" ? "an SMS" : "an email"} is ${max}.` };
  }
  const unknown = findUnknownPlaceholders(body, def.placeholders);
  if (unknown.length > 0) {
    return {
      ok: false,
      error: `${unknown.map((u) => `{${u}}`).join(", ")} isn't available in this message. You can use: ${def.placeholders.map((p) => `{${p}}`).join(" ")}`,
    };
  }

  const stored = await readStored();
  // Text identical to the default isn't stored as an override, so the message keeps following the
  // default wording if that's ever improved in code.
  stored[def.key] = {
    ...(body !== def.defaultBody ? { body } : {}),
    enabled: parsed.data.enabled,
  };
  await writeStored(stored);
  return { ok: true };
}

/** Throws away the edited wording so the message goes back to its default (its on/off switch is kept). */
export async function resetMessageTemplate(key: string): Promise<TemplateResult> {
  await requireAdmin();
  const def = TEMPLATE_BY_KEY[key as TemplateKey];
  if (!def) return { ok: false, error: "That message doesn't exist." };
  const stored = await readStored();
  const current = stored[def.key];
  stored[def.key] = current?.enabled === undefined ? {} : { enabled: current.enabled };
  await writeStored(stored);
  return { ok: true };
}
