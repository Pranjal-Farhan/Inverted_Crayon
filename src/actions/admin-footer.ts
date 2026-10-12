"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getAdminSession } from "@/lib/session";
import { invalidateContent } from "@/lib/invalidate";
import type {
  FooterSocialData,
  JournalPageData,
  FaqPageData,
  ContactPageData,
  LegalPageData,
} from "@/lib/footer-defaults";

async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) throw new Error("Not authorized.");
}

// Footer.tsx and the FAQ/Contact/Privacy/Terms/Journal pages all read their block through
// getContentBlock(), tagged "content" (public-cache.ts) — invalidateContent() is what actually
// makes an edit visible everywhere immediately, since the footer renders on every storefront
// page via (storefront)/layout.tsx, not just the one revalidatePath() call below reaches.
async function saveBlock(key: string, data: unknown, path: string) {
  await requireAdmin();
  await db.contentBlock.upsert({
    where: { key },
    update: { data: data as never },
    create: { key, data: data as never },
  });
  revalidatePath(path);
  revalidatePath("/admin/footer");
  invalidateContent();
}

export async function saveFooterSocial(data: FooterSocialData) {
  await saveBlock(
    "footer_social",
    {
      facebookUrl: data.facebookUrl.trim(),
      instagramUrl: data.instagramUrl.trim(),
      whatsappUrl: data.whatsappUrl.trim(),
    },
    "/",
  );
}

export async function saveJournalPage(data: JournalPageData) {
  await saveBlock("journal_page", { eyebrow: data.eyebrow.trim(), heading: data.heading.trim() }, "/journal");
}

export async function saveContactPage(data: ContactPageData) {
  await saveBlock(
    "contact_page",
    { heading: data.heading.trim(), intro: data.intro.trim(), extraNote: data.extraNote.trim() },
    "/contact",
  );
}

export type SaveFaqResult = { ok: true } | { ok: false; error: string };

export async function saveFaqPage(data: FaqPageData): Promise<SaveFaqResult> {
  const items = data.items
    .map((i) => ({ q: i.q.trim(), a: i.a.trim() }))
    .filter((i) => i.q.length > 0 && i.a.length > 0);
  if (items.length === 0) return { ok: false, error: "Add at least one question before publishing." };
  await saveBlock("faq_page", { heading: data.heading.trim(), items }, "/faq");
  return { ok: true };
}

export type SaveLegalResult = { ok: true } | { ok: false; error: string };

export async function savePrivacyPage(data: LegalPageData): Promise<SaveLegalResult> {
  const sections = data.sections
    .map((s) => ({ title: s.title.trim(), body: s.body.trim() }))
    .filter((s) => s.title.length > 0 && s.body.length > 0);
  if (sections.length === 0) return { ok: false, error: "Add at least one section before publishing." };
  await saveBlock(
    "privacy_page",
    { heading: data.heading.trim(), lastUpdated: data.lastUpdated.trim(), sections },
    "/privacy",
  );
  return { ok: true };
}

export async function saveTermsPage(data: LegalPageData): Promise<SaveLegalResult> {
  const sections = data.sections
    .map((s) => ({ title: s.title.trim(), body: s.body.trim() }))
    .filter((s) => s.title.length > 0 && s.body.length > 0);
  if (sections.length === 0) return { ok: false, error: "Add at least one section before publishing." };
  await saveBlock(
    "terms_page",
    { heading: data.heading.trim(), lastUpdated: data.lastUpdated.trim(), sections },
    "/terms",
  );
  return { ok: true };
}
