import type { Metadata } from "next";
import { getStoreInfo } from "@/lib/store-settings";
import { ContactForm } from "@/components/storefront/ContactForm";

export const metadata: Metadata = { title: "Contact" };

export default async function ContactPage() {
  const info = await getStoreInfo();

  return (
    <section className="pg pb-16">
      <div className="pt-8 pb-1.5">
        <h1 className="font-impact text-[clamp(40px,6vw,72px)] uppercase leading-[0.85] tracking-[1px]">Contact</h1>
        <p className="mt-3 max-w-[52ch] text-muted">Questions, wholesale, press — reach us.</p>
      </div>
      <div className="two grid gap-6 py-6 desktop:grid-cols-2">
        <div className="border border-line bg-panel p-4.5">
          <h3 className="font-impact mb-3.5 text-lg uppercase">Send a message</h3>
          <ContactForm />
        </div>
        <div className="border border-line bg-panel p-4.5">
          <h3 className="font-impact mb-3.5 text-lg uppercase">Reach us</h3>
          <p className="font-label text-sm tracking-[1.4px] text-muted">{info.email}</p>
          <p className="crumb mt-1.5">
            {info.phone} · {info.address}
          </p>
          <p className="crumb mt-1.5">IG · TikTok · @invertedcrayon</p>
        </div>
      </div>
    </section>
  );
}
