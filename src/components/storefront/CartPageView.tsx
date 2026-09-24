"use client";

import Link from "next/link";
import { useCart } from "@/context/cart-context";
import { Monogram } from "@/components/brand/Monogram";
import { PlaceholderFrame } from "@/components/ui/PlaceholderFrame";
import { Button } from "@/components/ui/Button";
import { PromoCodeField } from "@/components/storefront/PromoCodeField";
import { formatTaka } from "@/lib/money";
import { pickAccent } from "@/lib/accent-color";
import { preorderLineNote } from "@/lib/cart-types";

export function CartPageView() {
  const { cart, subtotal, removeLine, setQty, hydrated } = useCart();

  if (!hydrated) return null;

  return (
    <section className="pg pb-16">
      <div className="pagehead pb-0">
        <h1 className="font-impact text-[clamp(40px,6vw,72px)] uppercase leading-[0.85] tracking-[1px]">
          Your <span className="text-lime">Bag</span>
        </h1>
      </div>

      <div className="two grid grid-cols-1 gap-8 py-5 desktop:grid-cols-[1.5fr_1fr]">
        <div>
          {cart.lines.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <Monogram className="h-[52px] w-[74px]" />
              <p className="font-scrawl text-xl text-yellow">Your bag&apos;s empty — go stand out.</p>
              <Button href="/new">Shop new arrivals</Button>
            </div>
          ) : (
            cart.lines.map((line) => {
              const accent = pickAccent(line.productId);
              return (
                <div key={line.variantId} className="flex gap-3.5 border-b border-line py-4">
                  <Link href={`/product/${line.slug}`} className="w-[84px] shrink-0">
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
                      <button className="w-1/3 py-1 font-impact text-lg" onClick={() => setQty(line.variantId, line.qty - 1)}>
                        −
                      </button>
                      <span className="grid w-1/3 place-items-center font-impact">{line.qty}</span>
                      <button
                        className="w-1/3 py-1 font-impact text-lg"
                        onClick={() => setQty(line.variantId, line.qty + 1)}
                        disabled={line.qty >= line.maxQty}
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
                </div>
              );
            })
          )}
        </div>

        {cart.lines.length > 0 && (
          <div className="summary h-fit border border-line bg-panel p-5">
            <h3 className="font-impact mb-3.5 text-xl tracking-[0.5px]">Summary</h3>
            <PromoCodeField subtotal={subtotal} />
            <div className="flex justify-between py-1.5 text-sm text-[#ddd]">
              <span>Subtotal</span>
              <span className="price">{formatTaka(subtotal)}</span>
            </div>
            <div className="flex justify-between py-1.5 text-sm text-[#ddd]">
              <span>Shipping</span>
              <span className="text-muted">Calculated at checkout</span>
            </div>
            <div className="mt-2 flex justify-between border-t border-line pt-3">
              <span className="font-impact text-xl">Total</span>
              <span className="price text-xl">{formatTaka(subtotal)}</span>
            </div>
            <Button href="/checkout" className="mt-4 w-full">
              Checkout
            </Button>
            <Link href="/new" className="crumb mt-3 block text-center">
              Continue shopping
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
