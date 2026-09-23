import type { Metadata } from "next";

export const metadata: Metadata = { title: "FAQ" };

const FAQS: [string, string][] = [
  ["When will my order ship?", "Within 24–48h from Dhaka. Delivery 2–5 days domestic, 7–14 international."],
  ["How do preorders work?", "Pay a minimum 20% advance (up to 100%) via bKash or card, and the remainder is collected as cash on delivery. Ships on the date shown on the product page."],
  ["What's your return policy?", "14 days on unworn items with tags. Start a return from your account."],
  ["Which payments do you accept?", "bKash, cards via SSLCommerz, and cash on delivery."],
  ["Do you ship internationally?", "Yes — worldwide, calculated at checkout."],
];

export default function FAQPage() {
  return (
    <section className="pg pb-16">
      <div className="pt-8 pb-1.5">
        <h1 className="font-impact text-[clamp(40px,6vw,72px)] uppercase leading-[0.85] tracking-[1px]">
          Help / <span className="text-lime">FAQ</span>
        </h1>
      </div>
      <div className="doc max-w-[760px] py-4">
        {FAQS.map(([q, a]) => (
          <div key={q} className="border-b border-line py-3.5">
            <h4 className="font-label text-lg tracking-[1px]">{q}</h4>
            <p className="mt-1 text-sm text-muted">{a}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
