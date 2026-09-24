"use client";

import Link from "next/link";
import { useCart } from "@/context/cart-context";
import { Monogram } from "@/components/brand/Monogram";
import { PlaceholderFrame } from "@/components/ui/PlaceholderFrame";
import { Button } from "@/components/ui/Button";
import { formatTaka } from "@/lib/money";
import { pickAccent } from "@/lib/accent-color";
import { preorderLineNote } from "@/lib/cart-types";

export function CartDrawer() {
  const { cart, drawerOpen, closeDrawer, removeLine, setQty, subtotal, count } = useCart();

  return (
    <>
      <div
        className={`fixed inset-0 z-[190] bg-black/60 transition-opacity ${
          drawerOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={closeDrawer}
        aria-hidden="true"
      />
      <aside
        className={`fixed right-0 top-0 z-[195] flex h-full w-full max-w-[420px] flex-col border-l border-line bg-ink transition-transform ${
          drawerOpen ? "translate-x-0" : "translate-x-full"
        }`}
        aria-label="Cart"
        aria-hidden={!drawerOpen}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-impact text-lg uppercase tracking-[0.5px]">Your bag ({count})</h2>
          <button onClick={closeDrawer} aria-label="Close cart" className="text-2xl leading-none text-muted hover:text-paper">
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5">
          {cart.lines.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 py-16 text-center">
              <Monogram className="h-[44px] w-[62px]" />
              <p className="font-scrawl text-lg text-yellow">Your bag&apos;s empty — go stand out.</p>
              <Button href="/new" size="sm" onClick={closeDrawer}>
                Shop new arrivals
              </Button>
            </div>
          ) : (
            <ul>
              {cart.lines.map((line) => {
                const accent = pickAccent(line.productId);
                return (
                  <li key={line.variantId} className="flex gap-3.5 border-b border-line py-4">
                    <Link href={`/product/${line.slug}`} onClick={closeDrawer} className="w-[84px] shrink-0">
                      <PlaceholderFrame
                        accentColor={line.accentColor ?? accent.color}
                        shape={accent.shape}
                        stamp={false}
                        className="aspect-[1/1.1] w-full"
                      />
                    </Link>
                    <div className="flex-1">
                      <div className="font-medium">{line.title}</div>
                      <div className="text-[13px] text-muted">
                        {line.size} / {line.color}
                      </div>
                      {line.isPreorder && (
                        <div className="mt-1 text-[12px] font-label tracking-[1px] text-yellow">{preorderLineNote(line)}</div>
                      )}
                      <div className="mt-2 flex w-[110px] border border-line-2">
                        <button
                          className="w-1/3 py-1 font-impact text-lg"
                          onClick={() => setQty(line.variantId, line.qty - 1)}
                          aria-label="Decrease quantity"
                        >
                          −
                        </button>
                        <span className="grid w-1/3 place-items-center font-impact">{line.qty}</span>
                        <button
                          className="w-1/3 py-1 font-impact text-lg"
                          onClick={() => setQty(line.variantId, line.qty + 1)}
                          disabled={line.qty >= line.maxQty}
                          aria-label="Increase quantity"
                        >
                          +
                        </button>
                      </div>
                      <button
                        className="mt-2 font-label text-[12px] tracking-[1px] text-muted hover:text-error"
                        onClick={() => removeLine(line.variantId)}
                      >
                        REMOVE
                      </button>
                    </div>
                    <div className="price shrink-0">{formatTaka(line.unitPrice * line.qty)}</div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {cart.lines.length > 0 && (
          <div className="border-t border-line px-5 py-4">
            <div className="flex justify-between py-1.5 text-sm text-[#ddd]">
              <span>Subtotal</span>
              <span className="price">{formatTaka(subtotal)}</span>
            </div>
            <p className="text-[12px] text-muted">Shipping &amp; taxes at checkout</p>
            <Button href="/checkout" className="mt-4" onClick={closeDrawer}>
              Checkout
            </Button>
            <Link
              href="/cart"
              onClick={closeDrawer}
              className="mt-3 block text-center font-label text-[13px] tracking-[1px] text-muted hover:text-lime"
            >
              View bag
            </Link>
          </div>
        )}
      </aside>
    </>
  );
}
