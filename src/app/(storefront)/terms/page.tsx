import type { Metadata } from "next";
import { getContentBlock } from "@/lib/public-cache";
import { DEFAULT_TERMS_PAGE, type LegalPageData } from "@/lib/footer-defaults";

export const metadata: Metadata = { title: "Terms of Service" };
export const revalidate = 3600;

export default async function TermsPage() {
  const termsBlock = await getContentBlock("terms_page");
  const terms: LegalPageData = { ...DEFAULT_TERMS_PAGE, ...(termsBlock?.data as Partial<LegalPageData> | undefined) };

  return (
    <section className="pg pb-16">
      <div className="pt-8 pb-1.5">
        <h1 className="font-impact text-[clamp(40px,6vw,72px)] uppercase leading-[0.85] tracking-[1px]">{terms.heading}</h1>
      </div>
      <div className="doc max-w-[760px] py-4 text-[#d3d3d1]">
        <p className="text-sm text-muted">{terms.lastUpdated}</p>
        {terms.sections.map((s) => (
          <div key={s.title}>
            <h2 className="font-impact mt-6 mb-2 text-2xl uppercase tracking-[0.5px]">{s.title}</h2>
            <p>{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
