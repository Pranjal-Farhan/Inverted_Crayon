import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <section className="pg pb-16">
      <div className="pt-8 pb-1.5">
        <h1 className="font-impact text-[clamp(40px,6vw,72px)] uppercase leading-[0.85] tracking-[1px]">Privacy Policy</h1>
      </div>
      <div className="doc max-w-[760px] py-4 text-[#d3d3d1]">
        <p className="text-sm text-muted">Last updated September 2026.</p>

        <h2 className="font-impact mt-6 mb-2 text-2xl uppercase tracking-[0.5px]">What we collect</h2>
        <p>
          When you place an order, we collect your name, email, phone number, and shipping address. Guest checkout
          orders are identified by email — no password required. If you create an account, we also store your login
          credentials (hashed, never in plain text).
        </p>

        <h2 className="font-impact mt-6 mb-2 text-2xl uppercase tracking-[0.5px]">How we use it</h2>
        <p>
          Your details are used to fulfil and deliver orders, send order and shipping updates, respond to support
          requests, and — only if you opt in — send newsletter emails about drops and restocks. We never sell your
          data to third parties.
        </p>

        <h2 className="font-impact mt-6 mb-2 text-2xl uppercase tracking-[0.5px]">Payments</h2>
        <p>
          Payments are processed by bKash and SSLCommerz. We do not store your card, mobile banking PIN, or
          wallet credentials — those are handled directly by the payment gateway over an encrypted connection.
        </p>

        <h2 className="font-impact mt-6 mb-2 text-2xl uppercase tracking-[0.5px]">Cookies &amp; local storage</h2>
        <p>
          Your shopping bag is stored in your browser&apos;s local storage so it persists between visits. We use this
          only to remember your bag — not to track you across other sites.
        </p>

        <h2 className="font-impact mt-6 mb-2 text-2xl uppercase tracking-[0.5px]">Your rights</h2>
        <p>
          You can request a copy of the data we hold on you, ask us to correct it, or ask us to delete your account
          and associated data, by contacting us at the email on our Contact page.
        </p>
      </div>
    </section>
  );
}
