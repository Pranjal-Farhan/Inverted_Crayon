import type { Metadata } from "next";
import { getShippingRates, getPaymentGateways } from "@/lib/store-settings";
import { getCustomerSession } from "@/lib/session";
import { db } from "@/lib/db";
import { CheckoutView } from "@/components/storefront/CheckoutView";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  const session = await getCustomerSession();
  const [rates, gateways, customer, address] = await Promise.all([
    getShippingRates(),
    getPaymentGateways(),
    session ? db.customer.findUnique({ where: { id: session.customerId } }) : null,
    // Same "default sorts first" convention as /account/addresses — the customer's own default
    // address (or, failing that, whichever one they saved) is what checkout should prefill with.
    session ? db.address.findFirst({ where: { customerId: session.customerId }, orderBy: { isDefault: "desc" } }) : null,
  ]);

  return (
    <section className="pg pb-16">
      <div className="pagehead pb-1.5">
        <div className="font-label text-sm tracking-[1.4px] text-muted">
          {customer ? `Returning customer · ${customer.name ?? customer.email}` : "Guest checkout · no account needed"}
        </div>
        <h1 className="font-impact text-[clamp(40px,6vw,72px)] uppercase leading-[0.85] tracking-[1px]">Checkout</h1>
      </div>
      <CheckoutView
        rates={rates}
        gateways={gateways}
        customer={
          customer
            ? {
                email: customer.email,
                phone: customer.phone,
                name: customer.name,
                address: address
                  ? {
                      fullName: address.fullName,
                      phone: address.phone,
                      line1: address.line1,
                      area: address.area,
                      district: address.district,
                      postcode: address.postcode,
                      country: address.country,
                    }
                  : null,
              }
            : null
        }
      />
    </section>
  );
}
