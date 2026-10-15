"use client";

import { useState, useTransition } from "react";
import {
  saveFooterSocial,
  saveFaqPage,
  saveContactPage,
  savePrivacyPage,
  saveTermsPage,
} from "@/actions/admin-footer";
import type {
  FooterSocialData,
  FaqPageData,
  ContactPageData,
  LegalPageData,
} from "@/lib/footer-defaults";
import { Panel } from "@/components/admin/Panel";

const inputClass = "w-full border border-line-2 bg-ink px-2.5 py-1.5 text-sm outline-none focus:border-lime";

/** Shared row editor for "two text fields per row, add/remove" content — the FAQ's
 * question/answer pairs and the Privacy/Terms sections (title/body) are the same shape. */
function TwoFieldRows({
  rows,
  labelA,
  labelB,
  multilineB = false,
  onChangeA,
  onChangeB,
  onAdd,
  onRemove,
  addLabel,
}: {
  rows: { a: string; b: string }[];
  labelA: string;
  labelB: string;
  multilineB?: boolean;
  onChangeA: (i: number, value: string) => void;
  onChangeB: (i: number, value: string) => void;
  onAdd: () => void;
  onRemove: (i: number) => void;
  addLabel: string;
}) {
  return (
    <div>
      {rows.map((row, i) => (
        <div key={i} className="mb-3 border border-line-2 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-label text-[11px] tracking-[1px] text-muted-2">
              {labelA} {i + 1}
            </span>
            {rows.length > 1 && (
              <button type="button" onClick={() => onRemove(i)} className="text-[12px] text-muted hover:text-error">
                Remove
              </button>
            )}
          </div>
          <input value={row.a} onChange={(e) => onChangeA(i, e.target.value)} placeholder={labelA} className={`${inputClass} mb-2`} />
          {multilineB ? (
            <textarea value={row.b} onChange={(e) => onChangeB(i, e.target.value)} placeholder={labelB} rows={3} className={inputClass} />
          ) : (
            <input value={row.b} onChange={(e) => onChangeB(i, e.target.value)} placeholder={labelB} className={inputClass} />
          )}
        </div>
      ))}
      <button type="button" onClick={onAdd} className="border border-line-2 px-3 py-1.5 text-[13px] hover:border-lime">
        {addLabel}
      </button>
    </div>
  );
}

export function FooterCmsView({
  social,
  faq,
  contact,
  privacy,
  terms,
}: {
  social: FooterSocialData;
  faq: FaqPageData;
  contact: ContactPageData;
  privacy: LegalPageData;
  terms: LegalPageData;
}) {
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState<string | null>(null);
  function flash(key: string) {
    setSaved(key);
    setTimeout(() => setSaved(null), 2000);
  }

  const [socialData, setSocialData] = useState(social);
  const [faqData, setFaqData] = useState(faq);
  const [faqError, setFaqError] = useState<string | null>(null);
  const [contactData, setContactData] = useState(contact);
  const [privacyData, setPrivacyData] = useState(privacy);
  const [privacyError, setPrivacyError] = useState<string | null>(null);
  const [termsData, setTermsData] = useState(terms);
  const [termsError, setTermsError] = useState<string | null>(null);

  return (
    <div>
      <p className="mb-4.5 max-w-[70ch] text-[13px] text-muted">
        Controls the footer (social links, and what every navigational link in it points to) and the
        text content of the FAQ, Contact, Privacy, and Terms pages. Shipping &amp; Returns has
        been removed site-wide.
      </p>

      <Panel title="Social links">
        <p className="mb-3 text-[13px] text-muted">
          Only Facebook, Instagram, and WhatsApp show in the footer now. Leave a field blank to hide
          that icon entirely.
        </p>
        <div className="mb-2.5">
          <label className="font-label mb-1 block text-[12px] tracking-[1px] text-muted">Facebook URL</label>
          <input
            value={socialData.facebookUrl}
            onChange={(e) => setSocialData((d) => ({ ...d, facebookUrl: e.target.value }))}
            placeholder="https://facebook.com/invertedcrayon"
            className={inputClass}
          />
        </div>
        <div className="mb-2.5">
          <label className="font-label mb-1 block text-[12px] tracking-[1px] text-muted">Instagram URL</label>
          <input
            value={socialData.instagramUrl}
            onChange={(e) => setSocialData((d) => ({ ...d, instagramUrl: e.target.value }))}
            placeholder="https://instagram.com/invertedcrayon"
            className={inputClass}
          />
        </div>
        <div className="mb-3">
          <label className="font-label mb-1 block text-[12px] tracking-[1px] text-muted">WhatsApp URL</label>
          <input
            value={socialData.whatsappUrl}
            onChange={(e) => setSocialData((d) => ({ ...d, whatsappUrl: e.target.value }))}
            placeholder="https://wa.me/8801XXXXXXXXX"
            className={inputClass}
          />
        </div>
        <button
          disabled={pending}
          onClick={() => startTransition(async () => { await saveFooterSocial(socialData); flash("social"); })}
          className="btn-primary bg-lime px-4 py-2 font-impact text-sm text-ink disabled:opacity-50"
        >
          {saved === "social" ? "Published ✓" : "Publish"}
        </button>
      </Panel>

      <Panel title="FAQ page" className="mt-4.5">
        <div className="mb-3">
          <label className="font-label mb-1 block text-[12px] tracking-[1px] text-muted">Heading</label>
          <input
            value={faqData.heading}
            onChange={(e) => setFaqData((d) => ({ ...d, heading: e.target.value }))}
            className={inputClass}
          />
        </div>
        <TwoFieldRows
          rows={faqData.items.map((i) => ({ a: i.q, b: i.a }))}
          labelA="Question"
          labelB="Answer"
          multilineB
          onChangeA={(i, v) => setFaqData((d) => ({ ...d, items: d.items.map((it, idx) => (idx === i ? { ...it, q: v } : it)) }))}
          onChangeB={(i, v) => setFaqData((d) => ({ ...d, items: d.items.map((it, idx) => (idx === i ? { ...it, a: v } : it)) }))}
          onAdd={() => setFaqData((d) => ({ ...d, items: [...d.items, { q: "", a: "" }] }))}
          onRemove={(i) => setFaqData((d) => ({ ...d, items: d.items.filter((_, idx) => idx !== i) }))}
          addLabel="+ Add question"
        />
        {faqError && <p className="mt-2 text-[13px] text-error">{faqError}</p>}
        <button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setFaqError(null);
              const res = await saveFaqPage(faqData);
              if (!res.ok) {
                setFaqError(res.error);
                return;
              }
              flash("faq");
            })
          }
          className="mt-3 btn-primary bg-lime px-4 py-2 font-impact text-sm text-ink disabled:opacity-50"
        >
          {saved === "faq" ? "Published ✓" : "Publish"}
        </button>
      </Panel>

      <Panel title="Contact page" className="mt-4.5">
        <p className="mb-3 text-[13px] text-muted">
          The email/phone/address shown here already come from Settings → Store info — only the
          surrounding copy is editable here.
        </p>
        <div className="mb-2.5">
          <label className="font-label mb-1 block text-[12px] tracking-[1px] text-muted">Heading</label>
          <input
            value={contactData.heading}
            onChange={(e) => setContactData((d) => ({ ...d, heading: e.target.value }))}
            className={inputClass}
          />
        </div>
        <div className="mb-2.5">
          <label className="font-label mb-1 block text-[12px] tracking-[1px] text-muted">Intro line</label>
          <input
            value={contactData.intro}
            onChange={(e) => setContactData((d) => ({ ...d, intro: e.target.value }))}
            className={inputClass}
          />
        </div>
        <div className="mb-3">
          <label className="font-label mb-1 block text-[12px] tracking-[1px] text-muted">
            Extra note (under phone/address)
          </label>
          <input
            value={contactData.extraNote}
            onChange={(e) => setContactData((d) => ({ ...d, extraNote: e.target.value }))}
            className={inputClass}
          />
        </div>
        <button
          disabled={pending}
          onClick={() => startTransition(async () => { await saveContactPage(contactData); flash("contact"); })}
          className="btn-primary bg-lime px-4 py-2 font-impact text-sm text-ink disabled:opacity-50"
        >
          {saved === "contact" ? "Published ✓" : "Publish"}
        </button>
      </Panel>

      <Panel title="Privacy policy" className="mt-4.5">
        <div className="mb-2.5 grid grid-cols-1 gap-2.5 desktop:grid-cols-2">
          <div>
            <label className="font-label mb-1 block text-[12px] tracking-[1px] text-muted">Heading</label>
            <input
              value={privacyData.heading}
              onChange={(e) => setPrivacyData((d) => ({ ...d, heading: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div>
            <label className="font-label mb-1 block text-[12px] tracking-[1px] text-muted">&quot;Last updated&quot; line</label>
            <input
              value={privacyData.lastUpdated}
              onChange={(e) => setPrivacyData((d) => ({ ...d, lastUpdated: e.target.value }))}
              className={inputClass}
            />
          </div>
        </div>
        <TwoFieldRows
          rows={privacyData.sections.map((s) => ({ a: s.title, b: s.body }))}
          labelA="Section title"
          labelB="Section body"
          multilineB
          onChangeA={(i, v) => setPrivacyData((d) => ({ ...d, sections: d.sections.map((s, idx) => (idx === i ? { ...s, title: v } : s)) }))}
          onChangeB={(i, v) => setPrivacyData((d) => ({ ...d, sections: d.sections.map((s, idx) => (idx === i ? { ...s, body: v } : s)) }))}
          onAdd={() => setPrivacyData((d) => ({ ...d, sections: [...d.sections, { title: "", body: "" }] }))}
          onRemove={(i) => setPrivacyData((d) => ({ ...d, sections: d.sections.filter((_, idx) => idx !== i) }))}
          addLabel="+ Add section"
        />
        {privacyError && <p className="mt-2 text-[13px] text-error">{privacyError}</p>}
        <button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setPrivacyError(null);
              const res = await savePrivacyPage(privacyData);
              if (!res.ok) {
                setPrivacyError(res.error);
                return;
              }
              flash("privacy");
            })
          }
          className="mt-3 btn-primary bg-lime px-4 py-2 font-impact text-sm text-ink disabled:opacity-50"
        >
          {saved === "privacy" ? "Published ✓" : "Publish"}
        </button>
      </Panel>

      <Panel title="Terms of service" className="mt-4.5">
        <div className="mb-2.5 grid grid-cols-1 gap-2.5 desktop:grid-cols-2">
          <div>
            <label className="font-label mb-1 block text-[12px] tracking-[1px] text-muted">Heading</label>
            <input
              value={termsData.heading}
              onChange={(e) => setTermsData((d) => ({ ...d, heading: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div>
            <label className="font-label mb-1 block text-[12px] tracking-[1px] text-muted">&quot;Last updated&quot; line</label>
            <input
              value={termsData.lastUpdated}
              onChange={(e) => setTermsData((d) => ({ ...d, lastUpdated: e.target.value }))}
              className={inputClass}
            />
          </div>
        </div>
        <TwoFieldRows
          rows={termsData.sections.map((s) => ({ a: s.title, b: s.body }))}
          labelA="Section title"
          labelB="Section body"
          multilineB
          onChangeA={(i, v) => setTermsData((d) => ({ ...d, sections: d.sections.map((s, idx) => (idx === i ? { ...s, title: v } : s)) }))}
          onChangeB={(i, v) => setTermsData((d) => ({ ...d, sections: d.sections.map((s, idx) => (idx === i ? { ...s, body: v } : s)) }))}
          onAdd={() => setTermsData((d) => ({ ...d, sections: [...d.sections, { title: "", body: "" }] }))}
          onRemove={(i) => setTermsData((d) => ({ ...d, sections: d.sections.filter((_, idx) => idx !== i) }))}
          addLabel="+ Add section"
        />
        {termsError && <p className="mt-2 text-[13px] text-error">{termsError}</p>}
        <button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setTermsError(null);
              const res = await saveTermsPage(termsData);
              if (!res.ok) {
                setTermsError(res.error);
                return;
              }
              flash("terms");
            })
          }
          className="mt-3 btn-primary bg-lime px-4 py-2 font-impact text-sm text-ink disabled:opacity-50"
        >
          {saved === "terms" ? "Published ✓" : "Publish"}
        </button>
      </Panel>
    </div>
  );
}
