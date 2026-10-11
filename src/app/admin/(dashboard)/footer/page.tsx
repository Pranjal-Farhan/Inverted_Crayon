import { db } from "@/lib/db";
import { FooterCmsView } from "@/components/admin/FooterCmsView";
import { DEFAULT_FOOTER_SOCIAL, type FooterSocialData } from "@/lib/footer-defaults";
import { DEFAULT_JOURNAL_PAGE, type JournalPageData } from "@/lib/footer-defaults";
import { DEFAULT_FAQ_PAGE, type FaqPageData } from "@/lib/footer-defaults";
import { DEFAULT_CONTACT_PAGE, type ContactPageData } from "@/lib/footer-defaults";
import { DEFAULT_PRIVACY_PAGE, DEFAULT_TERMS_PAGE, type LegalPageData } from "@/lib/footer-defaults";

export default async function AdminFooterPage() {
  const [socialBlock, journalBlock, faqBlock, contactBlock, privacyBlock, termsBlock] = await Promise.all([
    db.contentBlock.findUnique({ where: { key: "footer_social" } }),
    db.contentBlock.findUnique({ where: { key: "journal_page" } }),
    db.contentBlock.findUnique({ where: { key: "faq_page" } }),
    db.contentBlock.findUnique({ where: { key: "contact_page" } }),
    db.contentBlock.findUnique({ where: { key: "privacy_page" } }),
    db.contentBlock.findUnique({ where: { key: "terms_page" } }),
  ]);

  const social: FooterSocialData = { ...DEFAULT_FOOTER_SOCIAL, ...(socialBlock?.data as Partial<FooterSocialData> | undefined) };
  const journal: JournalPageData = { ...DEFAULT_JOURNAL_PAGE, ...(journalBlock?.data as Partial<JournalPageData> | undefined) };
  const faq: FaqPageData = { ...DEFAULT_FAQ_PAGE, ...(faqBlock?.data as Partial<FaqPageData> | undefined) };
  const contact: ContactPageData = { ...DEFAULT_CONTACT_PAGE, ...(contactBlock?.data as Partial<ContactPageData> | undefined) };
  const privacy: LegalPageData = { ...DEFAULT_PRIVACY_PAGE, ...(privacyBlock?.data as Partial<LegalPageData> | undefined) };
  const terms: LegalPageData = { ...DEFAULT_TERMS_PAGE, ...(termsBlock?.data as Partial<LegalPageData> | undefined) };

  return (
    <FooterCmsView social={social} journal={journal} faq={faq} contact={contact} privacy={privacy} terms={terms} />
  );
}
