import type { Metadata } from "next";
import { getContentBlock } from "@/lib/public-cache";
import { DEFAULT_FAQ_PAGE, type FaqPageData } from "@/lib/footer-defaults";

export const metadata: Metadata = { title: "FAQ" };
export const revalidate = 3600;

export default async function FAQPage() {
  const faqBlock = await getContentBlock("faq_page");
  const faq: FaqPageData = { ...DEFAULT_FAQ_PAGE, ...(faqBlock?.data as Partial<FaqPageData> | undefined) };

  return (
    <section className="pg pb-16">
      <div className="pt-8 pb-1.5">
        <h1 className="font-impact text-[clamp(40px,6vw,72px)] uppercase leading-[0.85] tracking-[1px]">
          {faq.heading}
        </h1>
      </div>
      <div className="doc max-w-[760px] py-4">
        {faq.items.map((item) => (
          <div key={item.q} className="border-b border-line py-3.5">
            <h4 className="font-label text-lg tracking-[1px]">{item.q}</h4>
            <p className="mt-1 text-sm text-muted">{item.a}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
