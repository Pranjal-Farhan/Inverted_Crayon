import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <section className="pg pb-16">
      <div className="pt-8 pb-1.5">
        <h1 className="font-impact text-[clamp(40px,6vw,72px)] uppercase leading-[0.85] tracking-[1px]">Terms of Service</h1>
      </div>
      <div className="doc max-w-[760px] py-4 text-[#d3d3d1]">
        <p className="text-sm text-muted">Last updated September 2026.</p>

        <h2 className="font-impact mt-6 mb-2 text-2xl uppercase tracking-[0.5px]">Orders &amp; pricing</h2>
        <p>
          All prices are listed in Bangladeshi Taka (৳) and include applicable taxes unless stated otherwise. We
          reserve the right to correct pricing errors and to cancel and refund orders placed at an incorrect price.
        </p>

        <h2 className="font-impact mt-6 mb-2 text-2xl uppercase tracking-[0.5px]">Preorders</h2>
        <p>
          Preorder items are charged at the time of order and ship on the date shown on the product page at time of
          purchase. Ship dates are estimates and may shift; we&apos;ll email you if a date changes.
        </p>

        <h2 className="font-impact mt-6 mb-2 text-2xl uppercase tracking-[0.5px]">Payments</h2>
        <p>
          We accept bKash, Nagad, card / mobile banking via SSLCommerz, and cash on delivery (where available). Cash
          on delivery orders may be limited by delivery area.
        </p>

        <h2 className="font-impact mt-6 mb-2 text-2xl uppercase tracking-[0.5px]">Returns &amp; refunds</h2>
        <p>
          Unworn items with tags attached may be returned within 14 days of delivery. See our{" "}
          <a href="/shipping-returns" className="text-cyan">Shipping &amp; Returns</a> page for the full policy.
        </p>

        <h2 className="font-impact mt-6 mb-2 text-2xl uppercase tracking-[0.5px]">Intellectual property</h2>
        <p>
          All designs, artwork, and the Inverted Crayon name and marks are the property of Inverted Crayon. Product
          images may not be reused without permission.
        </p>

        <h2 className="font-impact mt-6 mb-2 text-2xl uppercase tracking-[0.5px]">Contact</h2>
        <p>Questions about these terms? Reach us on the Contact page.</p>
      </div>
    </section>
  );
}
