"use client";

import { useState } from "react";
import { useCart } from "@/context/cart-context";
import { usePromoValidation } from "@/lib/use-promo";

export function PromoCodeField({ subtotal }: { subtotal: number }) {
  const { cart, setPromoCode } = useCart();
  const [input, setInput] = useState("");
  const { result, loading } = usePromoValidation(cart.promoCode, subtotal);

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
          placeholder="Promo code"
          className="flex-1 border border-line-2 bg-ink px-2.5 py-2 outline-none focus:border-lime"
        />
        <button
          type="submit"
          className="border border-line-2 px-3.5 py-2 font-impact text-sm hover:border-lime disabled:opacity-50"
          disabled={loading}
        >
          Apply
        </button>
      </form>
      {cart.promoCode && (
        <div className="mt-1.5 flex items-center justify-between text-[12px]">
          {loading ? (
            <span className="text-muted">Checking {cart.promoCode}…</span>
          ) : result?.ok ? (
            <span className="text-lime">{result.code} applied</span>
          ) : (
            <span className="text-error">{result?.reason ?? "That code isn't valid."}</span>
          )}
          <button onClick={() => setPromoCode(null)} className="text-muted hover:text-paper">
            Remove
          </button>
        </div>
      )}
    </div>
  );
}
