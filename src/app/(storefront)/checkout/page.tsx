import type { Metadata } from "next";
import { getShippingRates, getPaymentGateways } from "@/lib/store-settings";
import { CheckoutView } from "@/components/storefront/CheckoutView";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  const [rates, gateways] = await Promise.all([getShippingRates(), getPaymentGateways()]);

  return (
    <section className="pg pb-16">
      <div className="pagehead pb-1.5">
        <div className="font-label text-sm tracking-[1.4px] text-muted">Guest checkout · no account needed</div>
        <h1 className="font-impact text-[clamp(40px,6vw,72px)] uppercase leading-[0.85] tracking-[1px]">Checkout</h1>
      </div>
      <CheckoutView rates={rates} gateways={gateways} />
    </section>
  );
}
