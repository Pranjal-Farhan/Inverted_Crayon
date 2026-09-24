"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useCart } from "@/context/cart-context";
import { cartHasPreorder, cartHasInStock } from "@/lib/cart-types";
import { placeOrder, captureAbandonedCheckout } from "@/actions/checkout";
import { usePromoValidation } from "@/lib/use-promo";
import { formatTaka } from "@/lib/money";
import { Button } from "@/components/ui/Button";
import type { PaymentGatewaySettings, ShippingRates } from "@/lib/store-settings";

type ShippingZoneKey = keyof ShippingRates;

const ZONE_ORDER: ShippingZoneKey[] = ["INSIDE_DHAKA", "OUTSIDE_DHAKA", "INTERNATIONAL"];

const PAYMENT_LABELS: Record<string, string> = {
  BKASH: "bKash",
  SSLCOMMERZ: "Card / mobile banking (SSLCommerz)",
  COD: "Cash on delivery",
};

const PAYMENT_ERROR_MESSAGES: Record<string, string> = {
  failed: "Your payment didn't go through. Your bag has been restored — please try again.",
  cancelled: "Payment was cancelled. Your bag has been restored.",
  error: "Something went wrong starting your payment. Please try again.",
};

export function CheckoutView({
  rates,
  gateways,
}: {
  rates: ShippingRates;
  gateways: PaymentGatewaySettings;
}) {
  const { cart, subtotal, clearCart } = useCart();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const payment = searchParams.get("payment");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reflecting a redirect-back query param into local state, not derived from props
    if (payment && PAYMENT_ERROR_MESSAGES[payment]) setError(PAYMENT_ERROR_MESSAGES[payment]);
  }, [searchParams]);

  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [shipPhone, setShipPhone] = useState("");
  const [line1, setLine1] = useState("");
  const [area, setArea] = useState("");
  const [district, setDistrict] = useState("");
  const [postcode, setPostcode] = useState("");
  const [country, setCountry] = useState("Bangladesh");
  const [zone, setZone] = useState<ShippingZoneKey>("INSIDE_DHAKA");
  const [paymentMethod, setPaymentMethod] = useState<"BKASH" | "SSLCOMMERZ" | "COD">(
    gateways.bkash ? "BKASH" : gateways.sslcommerz ? "SSLCOMMERZ" : "COD",
  );
  const [preorderShipMode, setPreorderShipMode] = useState<"together" | "split">("together");

  const { result: promoResult } = usePromoValidation(cart.promoCode, subtotal);
  const freeShipping = promoResult?.ok && promoResult.type === "FREE_SHIPPING";
  const discountAmount = promoResult?.ok ? promoResult.amount : 0;
  const shippingCost = freeShipping ? 0 : rates[zone].cost;
  const total = Math.max(subtotal - discountAmount + shippingCost, 0);

  const hasPreorder = cartHasPreorder(cart);
  const hasInStock = cartHasInStock(cart);
  const mixedCart = hasPreorder && hasInStock;

  // Advance/balance are no longer a customer choice — each preorder line's advance is whatever
  // the admin set on that variant (0 or more), snapshotted onto the cart line when it was added.
  // Only the held-back portion of preorder items (unitPrice - advance) can ever become COD; the
  // rest of the order (shipping, discount, any in-stock items) is always due now.
  const preorderLines = cart.lines.filter((l) => l.isPreorder);
  const preorderHoldback = preorderLines.reduce(
    (s, l) => s + (l.unitPrice - (l.preorderAdvanceAmount ?? l.unitPrice)) * l.qty,
    0,
  );
  // Nothing is ever actually captured online for COD — matches the server's placeOrder computation.
  const advanceAmount =
    paymentMethod === "COD" ? 0 : Math.max(Math.round((total - preorderHoldback) * 100) / 100, 0);
  const balanceDue = Math.max(Math.round((total - advanceAmount) * 100) / 100, 0);
  const allPreorderLinesFree = preorderLines.every((l) => (l.preorderAdvanceAmount ?? l.unitPrice) === 0);

  const codAllowed = gateways.cod && allPreorderLinesFree && (gateways.codRule === "nationwide" || zone === "INSIDE_DHAKA");
  const availableMethods = (["BKASH", "SSLCOMMERZ", "COD"] as const).filter((m) => {
    if (m === "BKASH") return gateways.bkash;
    if (m === "SSLCOMMERZ") return gateways.sslcommerz;
    return codAllowed;
  });

  useEffect(() => {
    if (!availableMethods.includes(paymentMethod) && availableMethods.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing selection to the derived set of methods the current cart/zone actually allows
      setPaymentMethod(availableMethods[0]);
    }
  }, [availableMethods, paymentMethod]);

  if (cart.lines.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-muted">Your bag is empty — add something before checking out.</p>
        <Button href="/new" className="mt-4">
          Shop new arrivals
        </Button>
      </div>
    );
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!/^\S+@\S+\.\S+$/.test(email)) errs.email = "Enter a valid email.";
    if (phone.trim().length < 6) errs.phone = "Enter a valid phone number.";
    if (fullName.trim().length < 2) errs.fullName = "Enter your full name.";
    if (shipPhone.trim().length < 6) errs.shipPhone = "Enter a valid phone number.";
    if (line1.trim().length < 4) errs.line1 = "Enter your street address.";
    if (area.trim().length < 2) errs.area = "Enter your area.";
    if (district.trim().length < 2) errs.district = "Enter your district.";
    if (postcode.trim().length < 3) errs.postcode = "Enter a valid postcode.";
    if (!availableMethods.includes(paymentMethod)) errs.paymentMethod = "Choose a payment method.";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function submit() {
    setError(null);
    if (!validate()) {
      setError("That didn't go through. Check the fields in red and try again.");
      return;
    }
    startTransition(async () => {
      const res = await placeOrder({
        email,
        phone,
        shipping: { fullName, phone: shipPhone, line1, area, district, postcode, country },
        shippingZone: zone,
        paymentMethod,
        promoCode: promoResult?.ok ? cart.promoCode : null,
        preorderShipMode,
        lines: cart.lines.map((l) => ({ variantId: l.variantId, qty: l.qty })),
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      clearCart();
      if (res.redirectUrl) {
        window.location.href = res.redirectUrl;
        return;
      }
      router.push(`/order/${res.orderNumber}`);
    });
  }

  return (
    <div className="two grid grid-cols-1 gap-7 py-5 desktop:grid-cols-[1.5fr_1fr]">
      <div className="min-w-0">
        <Step n={1} title="Contact">
          <Field label="Email" error={fieldErrors.email}>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => {
                if (/^\S+@\S+\.\S+$/.test(email) && cart.lines.length > 0) {
                  captureAbandonedCheckout({
                    email,
                    lines: cart.lines.map((l) => ({ title: l.title, size: l.size, color: l.color, qty: l.qty, unitPrice: l.unitPrice })),
                  });
                }
              }}
              type="email"
              className={inputClass(fieldErrors.email)}
            />
          </Field>
          <Field label="Phone (delivery SMS)" error={fieldErrors.phone}>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass(fieldErrors.phone)} />
          </Field>
        </Step>

        <Step n={2} title="Shipping address">
          <div className="frow grid grid-cols-2 gap-3">
            <Field label="Full name" error={fieldErrors.fullName}>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass(fieldErrors.fullName)} />
            </Field>
            <Field label="Phone" error={fieldErrors.shipPhone}>
              <input value={shipPhone} onChange={(e) => setShipPhone(e.target.value)} className={inputClass(fieldErrors.shipPhone)} />
            </Field>
          </div>
          <Field label="Address" error={fieldErrors.line1}>
            <input value={line1} onChange={(e) => setLine1(e.target.value)} className={inputClass(fieldErrors.line1)} />
          </Field>
          <div className="frow grid grid-cols-2 gap-3">
            <Field label="Area / City" error={fieldErrors.area}>
              <input value={area} onChange={(e) => setArea(e.target.value)} className={inputClass(fieldErrors.area)} />
            </Field>
            <Field label="District" error={fieldErrors.district}>
              <input value={district} onChange={(e) => setDistrict(e.target.value)} className={inputClass(fieldErrors.district)} />
            </Field>
          </div>
          <div className="frow grid grid-cols-2 gap-3">
            <Field label="Postcode" error={fieldErrors.postcode}>
              <input value={postcode} onChange={(e) => setPostcode(e.target.value)} className={inputClass(fieldErrors.postcode)} />
            </Field>
            <Field label="Country">
              <select value={country} onChange={(e) => setCountry(e.target.value)} className={inputClass()}>
                <option>Bangladesh</option>
                <option>International</option>
              </select>
            </Field>
          </div>
        </Step>

        <Step n={3} title="Shipping method">
          <div className="flex flex-col gap-2">
            {ZONE_ORDER.map((z) => (
              <label
                key={z}
                className={`flex items-center gap-2.5 border px-3.5 py-2.5 text-sm ${zone === z ? "border-lime" : "border-line-2"}`}
              >
                <input type="radio" name="zone" checked={zone === z} onChange={() => setZone(z)} className="accent-lime" />
                {rates[z].label} — {z === "INTERNATIONAL" ? formatTaka(rates[z].cost) : formatTaka(rates[z].cost)} · {rates[z].etaDays}
              </label>
            ))}
          </div>
        </Step>

        {hasPreorder && (
          <Step n={4} title="Preorder advance">
            <p className="mb-3 text-sm text-muted">
              The advance for each preorder item is set by us, not chosen at checkout — some are free to reserve. The
              rest is collected as cash on delivery.
            </p>
            <div className="flex flex-col gap-1.5">
              {preorderLines.map((l) => {
                const advance = l.preorderAdvanceAmount ?? l.unitPrice;
                return (
                  <div key={l.variantId} className="flex justify-between text-[13px]">
                    <span className="text-muted">
                      {l.title} · {l.size} × {l.qty}
                    </span>
                    <span>
                      {advance > 0 ? `${formatTaka(advance * l.qty)} now` : "Free to reserve"}
                      {l.unitPrice - advance > 0 && ` · ${formatTaka((l.unitPrice - advance) * l.qty)} on delivery`}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex justify-between border-t border-line-2 pt-2.5 text-[13px]">
              <span>Pay now: {formatTaka(advanceAmount)}</span>
              {balanceDue > 0 && <span>Due on delivery: {formatTaka(balanceDue)}</span>}
            </div>
          </Step>
        )}

        <Step n={hasPreorder ? 5 : 4} title="Payment">
          <div className="flex flex-col gap-2">
            {availableMethods.map((m) => (
              <label
                key={m}
                className={`flex items-center gap-2.5 border px-3.5 py-2.5 text-sm transition-colors ${paymentMethod === m ? "border-lime" : "border-line-2"}`}
              >
                <input
                  type="radio"
                  name="payment"
                  checked={paymentMethod === m}
                  onChange={() => setPaymentMethod(m)}
                  className="accent-lime"
                />
                {PAYMENT_LABELS[m]}
              </label>
            ))}
          </div>
          {hasPreorder && !allPreorderLinesFree ? (
            <p className="mt-2 text-[12px] text-muted">
              Cash on delivery isn&apos;t available as the sole payment method here — {formatTaka(advanceAmount)} of
              this order needs to be paid online now, with the rest collected on delivery.
            </p>
          ) : (
            gateways.cod &&
            !codAllowed && <p className="mt-2 text-[12px] text-muted">Cash on delivery is available inside Dhaka only.</p>
          )}
        </Step>

        {mixedCart && (
          <Step n={6} title="Mixed cart">
            <p className="mb-2 text-sm text-muted">
              Your bag mixes in-stock and preorder items.
            </p>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2.5 text-sm">
                <input
                  type="radio"
                  checked={preorderShipMode === "together"}
                  onChange={() => setPreorderShipMode("together")}
                  className="accent-lime"
                />
                Ship together, once the preorder lands
              </label>
              <label className="flex items-center gap-2.5 text-sm">
                <input
                  type="radio"
                  checked={preorderShipMode === "split"}
                  onChange={() => setPreorderShipMode("split")}
                  className="accent-lime"
                />
                Ship available items now, preorder later
              </label>
            </div>
          </Step>
        )}
      </div>

      <div className="summary h-fit border border-line bg-panel p-5">
        <h3 className="font-impact mb-3.5 text-xl">Order</h3>
        {cart.lines.map((l) => (
          <div key={l.variantId} className="flex justify-between py-1.5 text-sm text-[#ddd]">
            <span>
              {l.title} · {l.size}
            </span>
            <span>{formatTaka(l.unitPrice * l.qty)}</span>
          </div>
        ))}
        {promoResult?.ok && (
          <div className="flex justify-between py-1.5 text-sm text-lime">
            <span>Promo ({promoResult.code})</span>
            <span>
              {promoResult.type === "FREE_SHIPPING" ? "Free shipping" : `−${formatTaka(discountAmount)}`}
            </span>
          </div>
        )}
        <div className="flex justify-between py-1.5 text-sm text-[#ddd]">
          <span>Shipping ({rates[zone].label})</span>
          <span>{shippingCost === 0 ? "Free" : formatTaka(shippingCost)}</span>
        </div>
        <div className="mt-2 flex justify-between border-t border-line pt-3">
          <span className="font-impact text-xl">Total</span>
          <span className="price text-xl">{formatTaka(total)}</span>
        </div>
        {hasPreorder && (
          <div className="mt-2 border-t border-dashed border-line-2 pt-2 text-sm">
            <div className="flex justify-between text-lime">
              <span>Pay now</span>
              <span>{formatTaka(advanceAmount)}</span>
            </div>
            {balanceDue > 0 && (
              <div className="flex justify-between text-muted">
                <span>Due on delivery</span>
                <span>{formatTaka(balanceDue)}</span>
              </div>
            )}
          </div>
        )}

        {error && <p className="mt-3 text-[13px] text-error">{error}</p>}

        <Button className="mt-4 w-full" onClick={submit} loading={pending}>
          Place order
        </Button>
        <p className="mt-3 text-center text-[12px] text-muted">
          <Link href="/cart">← Back to bag</Link>
        </p>
      </div>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="costep mb-3.5 border border-line bg-panel p-4.5">
      <span className="font-impact mr-2 text-lg text-pink">{n}</span>
      <h3 className="font-label inline text-[17px] tracking-[1.4px]">{title.toUpperCase()}</h3>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="field mb-3">
      <label className="font-label mb-1.5 block text-[13px] tracking-[1.2px] text-muted">{label}</label>
      {children}
      {error && <p className="mt-1 text-[12px] text-error">{error}</p>}
    </div>
  );
}

function inputClass(error?: string) {
  return `w-full border bg-ink px-3 py-2.5 outline-none focus:border-lime ${error ? "border-error" : "border-line-2"}`;
}
