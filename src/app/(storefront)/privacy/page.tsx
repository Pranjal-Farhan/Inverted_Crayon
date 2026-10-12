import type { Metadata } from "next";
import { getContentBlock } from "@/lib/public-cache";
import { DEFAULT_PRIVACY_PAGE, type LegalPageData } from "@/lib/footer-defaults";

export const metadata: Metadata = { title: "Privacy Policy" };
export const revalidate = 3600;

export default async function PrivacyPage() {
  const privacyBlock = await getContentBlock("privacy_page");
  const privacy: LegalPageData = { ...DEFAULT_PRIVACY_PAGE, ...(privacyBlock?.data as Partial<LegalPageData> | undefined) };

  return (
    <section className="pg pb-16">
      <div className="pt-8 pb-1.5">
        <h1 className="font-impact text-[clamp(40px,6vw,72px)] uppercase leading-[0.85] tracking-[1px]">{privacy.heading}</h1>
      </div>
      <div className="doc max-w-[760px] py-4 text-[#d3d3d1]">
        <p className="text-sm text-muted">{privacy.lastUpdated}</p>
        {privacy.sections.map((s) => (
          <div key={s.title}>
            <h2 className="font-impact mt-6 mb-2 text-2xl uppercase tracking-[0.5px]">{s.title}</h2>
            <p>{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
