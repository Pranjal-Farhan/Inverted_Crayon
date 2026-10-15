"use client";

import { useState } from "react";
import { useCart } from "@/context/cart-context";
import { couponBenefitLabel } from "@/lib/coupon-format";
import { formatTaka } from "@/lib/money";
import type { PromoResult } from "@/lib/use-promo";

/**
 * Checkout's coupon box. One coupon per order, enforced by what's on screen: once a coupon is
 * applied the input is replaced by the applied card, so switching means removing it first. The
 * validation result comes from the parent (CheckoutView runs the one /api/discount check and
 * prices the order from it) — this only reads and edits which code is on the cart.
 */
export function CouponBox({ result, loading }: { result: PromoResult; loading: boolean }) {
  const { cart, setPromoCode } = useCart();
  const [input, setInput] = useState("");
  const applied = result?.ok ? result : null;

  if (applied) {
    return (
      <div className="my-3 border border-lime/40 bg-lime/[0.07] px-3 py-2.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-label text-[12px] tracking-[1.2px] text-lime">COUPON APPLIED</div>
            <div className="mt-0.5 font-impact text-lg tracking-[0.5px]">{applied.code}</div>
            <div className="text-[13px] text-[#ddd]">
              {couponBenefitLabel(applied)}
              {applied.capApplied && applied.maxDiscountAmount != null
                ? ` — capped at ${formatTaka(applied.maxDiscountAmount)}`
                : ""}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setPromoCode(null);
              setInput("");
            }}
            className="shrink-0 text-[13px] text-muted hover:text-error"
          >
            Remove
          </button>
        </div>
        <p className="mt-1.5 text-[12px] text-muted-2">One coupon per order — remove this one to use a different code.</p>
      </div>
    );
  }

  return (
    <div className="my-3">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (input.trim()) setPromoCode(input.trim().toUpperCase());
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Coupon code"
          aria-label="Coupon code"
          className="min-w-0 flex-1 border border-line-2 bg-ink px-2.5 py-2 uppercase outline-none focus:border-lime"
        />
        <button
          type="submit"
          className="border border-line-2 px-3.5 py-2 font-impact text-sm hover:border-lime disabled:opacity-50"
          disabled={loading}
        >
          Apply
        </button>
      </form>
      {cart.promoCode &&
        (loading ? (
          <p className="mt-1.5 text-[12px] text-muted">Checking {cart.promoCode}…</p>
        ) : result && !result.ok ? (
          <div className="mt-1.5 flex items-start justify-between gap-3 text-[12px]">
            <span className="text-error">{result.reason}</span>
            <button
              type="button"
              onClick={() => {
                setPromoCode(null);
                setInput("");
              }}
              className="shrink-0 text-muted hover:text-paper"
            >
              Clear
            </button>
          </div>
        ) : null)}
    </div>
  );
}
