import type { Metadata } from "next";

export const metadata: Metadata = { title: "Shipping & Returns" };

export default function ShippingReturnsPage() {
  return (
    <section className="pg pb-16">
      <div className="pt-8 pb-1.5">
        <h1 className="font-impact text-[clamp(40px,6vw,72px)] uppercase leading-[0.85] tracking-[1px]">Shipping &amp; Returns</h1>
      </div>
      <div className="doc max-w-[760px] py-4">
        <h2 className="font-impact mt-6 mb-2 text-2xl uppercase tracking-[0.5px]">Shipping</h2>
        <p className="text-[#d3d3d1]">
          Dispatched within 24–48h from Dhaka. Inside Dhaka 2–3 days (৳60), outside Dhaka 3–5 days (৳120), international
          7–14 days (calculated at checkout).
        </p>
        <h2 className="font-impact mt-6 mb-2 text-2xl uppercase tracking-[0.5px]">Returns</h2>
        <p className="text-[#d3d3d1]">
          14-day returns on unworn items with tags. Start a return from your account or by contacting us. Refunds issued
          to the original payment method within 5–7 working days.
        </p>
        <h2 className="font-impact mt-6 mb-2 text-2xl uppercase tracking-[0.5px]">Preorders</h2>
        <p className="text-[#d3d3d1]">
          Preorder items ship on the date shown on the product page. Mixed carts can ship together or ship available
          items first — your choice at checkout.
        </p>
      </div>
    </section>
  );
}
