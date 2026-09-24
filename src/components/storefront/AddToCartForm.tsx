"use client";

import { useActionState, useMemo, useRef, useState, type MouseEvent } from "react";
import { useCart } from "@/context/cart-context";
import { Button } from "@/components/ui/Button";
import { formatTaka } from "@/lib/money";
import { subscribeBackInStock } from "@/actions/back-in-stock";
import { Crown } from "@/components/brand/Crown";

const SPLAT_COLORS = ["#ff2d84", "#c3f53a", "#26a7e6", "#ffd23b"];
type Splat = { id: number; x: number; y: number; size: number; color: string };

export type VariantOption = {
  id: string;
  size: string;
  color: string;
  colorHex: string | null;
  stockQty: number;
  price: number;
  /** Null = this variant isn't preorder-eligible once sold out. Set (incl. 0) = it is. */
  preorderAdvanceAmount: number | null;
};

function variantPreorderEligible(v: VariantOption): boolean {
  return v.stockQty <= 0 && v.preorderAdvanceAmount != null;
}

export function AddToCartForm({
  productId,
  slug,
  title,
  variants,
  isPreorder: productIsPreorder,
  preorderShipDate,
  accentColor,
}: {
  productId: string;
  slug: string;
  title: string;
  variants: VariantOption[];
  /** Product-level Preorder tag — drives ship-date messaging when a variant also carries a real ship date. */
  isPreorder: boolean;
  preorderShipDate: string | null;
  accentColor: string;
}) {
  const colors = useMemo(() => [...new Set(variants.map((v) => v.color))], [variants]);
  const sizes = useMemo(() => [...new Set(variants.map((v) => v.size))], [variants]);

  const [color, setColor] = useState(colors[0]);
  const [size, setSize] = useState(sizes[0]);
  const [qty, setQty] = useState(1);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const { addLine } = useCart();
  const [notifyState, notifyAction, notifyPending] = useActionState(subscribeBackInStock, null);

  const splatZoneRef = useRef<HTMLDivElement>(null);
  const [splats, setSplats] = useState<Splat[]>([]);
  const splatIdRef = useRef(0);

  function spawnSplat(e: MouseEvent) {
    const zone = splatZoneRef.current;
    if (!zone) return;
    const r = zone.getBoundingClientRect();
    const id = splatIdRef.current++;
    const splat: Splat = {
      id,
      x: e.clientX - r.left,
      y: e.clientY - r.top,
      size: 50 + Math.random() * 50,
      color: SPLAT_COLORS[Math.floor(Math.random() * SPLAT_COLORS.length)],
    };
    setSplats((prev) => [...prev, splat]);
    setTimeout(() => setSplats((prev) => prev.filter((s) => s.id !== id)), 750);
  }

  const variant = variants.find((v) => v.color === color && v.size === size);
  const variantStock = variant?.stockQty ?? 0;
  const preorderEligible = Boolean(variant) && variantPreorderEligible(variant!);
  const soldOut = Boolean(variant) && variantStock <= 0 && !preorderEligible;
  const canAdd = Boolean(variant) && (variantStock > 0 || preorderEligible);
  const advancePerUnit = preorderEligible ? (variant!.preorderAdvanceAmount ?? variant!.price) : 0;

  return (
    <div>
      {colors.length > 1 && (
        <>
          <p className="optlab mb-2 font-label text-sm tracking-[1.6px] text-muted">COLOR</p>
          <div className="mb-5.5 flex gap-2.5">
            {colors.map((c) => {
              const swatch = variants.find((v) => v.color === c)?.colorHex ?? "#444";
              return (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  aria-label={c}
                  title={c}
                  className={`h-[26px] w-[26px] rounded-full border-2 ${color === c ? "border-white" : "border-[#444]"}`}
                  style={{ background: swatch }}
                />
              );
            })}
          </div>
        </>
      )}

      <p className="optlab mb-2 font-label text-sm tracking-[1.6px] text-muted">SIZE</p>
      <div className="mb-5.5 flex flex-wrap gap-2">
        {sizes.map((s) => {
          const v = variants.find((x) => x.size === s && x.color === color);
          const vEligible = Boolean(v) && variantPreorderEligible(v!);
          const disabled = !v || (v.stockQty <= 0 && !vEligible);
          return (
            <button
              key={s}
              onClick={() => !disabled && setSize(s)}
              disabled={disabled}
              className={`grid h-[46px] w-[46px] place-items-center border font-label text-[17px] ${
                size === s ? "border-lime bg-lime text-ink" : vEligible && v!.stockQty <= 0 ? "border-yellow text-yellow" : "border-line-2"
              } ${disabled ? "text-muted-2 line-through border-dashed" : ""}`}
            >
              {s}
            </button>
          );
        })}
      </div>

      {preorderEligible && (
        <div key={variant?.id ?? "none"} className="preorder-pulse mb-4 flex items-center gap-2.5 border border-dashed border-yellow bg-yellow/[0.07] px-3.5 py-2.5 text-sm">
          <Crown className="h-[22px] w-6 shrink-0 text-yellow" />
          <span>
            {productIsPreorder && preorderShipDate
              ? `Preorder — ships ${preorderShipDate}.`
              : "This size just sold out — preorder it and we'll ship in 7–15 days."}{" "}
            <span className="text-lime">Free delivery.</span>
          </span>
        </div>
      )}

      <div ref={splatZoneRef} className="relative mb-4.5 flex gap-3">
        {splats.map((s) => (
          <span
            key={s.id}
            className="ink-splat"
            style={{ left: s.x, top: s.y, width: s.size, height: s.size, background: s.color }}
          />
        ))}
        <div className="flex border border-line-2">
          <button className="w-10 font-impact text-lg" onClick={() => setQty((q) => Math.max(1, q - 1))}>
            −
          </button>
          <span className="grid w-11 place-items-center font-impact">{qty}</span>
          <button
            className="w-10 font-impact text-lg"
            onClick={() => setQty((q) => Math.min(variant ? (preorderEligible ? 99 : variant.stockQty) : 99, q + 1))}
          >
            +
          </button>
        </div>

        {soldOut ? (
          <Button variant="ghost" className="min-w-0 flex-1" arrow={false} onClick={() => setNotifyOpen(true)}>
            Notify me
          </Button>
        ) : (
          <Button
            className={`min-w-0 flex-1 ${preorderEligible ? "!bg-yellow" : ""}`}
            disabled={!canAdd}
            onClick={(e) => {
              if (!variant) return;
              spawnSplat(e);
              addLine({
                variantId: variant.id,
                productId,
                slug,
                title,
                size: variant.size,
                color: variant.color,
                colorHex: variant.colorHex,
                accentColor,
                unitPrice: variant.price,
                qty,
                isPreorder: preorderEligible,
                preorderShipDate: productIsPreorder ? preorderShipDate : null,
                preorderAdvanceAmount: preorderEligible ? advancePerUnit : null,
                maxQty: preorderEligible ? 99 : variant.stockQty,
              });
            }}
          >
            {preorderEligible ? "Preorder" : "Add to cart"}
          </Button>
        )}
      </div>
      {variant && (
        <p className="text-[13px] text-muted">
          {formatTaka(variant.price)}
          {" · "}
          {preorderEligible
            ? advancePerUnit > 0
              ? `pay ${formatTaka(advancePerUnit)} now, ${formatTaka(variant.price - advancePerUnit)} on delivery`
              : "pay ৳0 now — reserve it, full amount on delivery"
            : variantStock > 0
              ? `${variantStock} in stock`
              : "Out of stock in this size"}
        </p>
      )}

      {notifyOpen && (
        <div className="overlay-fade-in fixed inset-0 z-[250] grid place-items-center bg-black/70 p-4" onClick={() => setNotifyOpen(false)}>
          <div
            className="w-full max-w-[380px] border border-line bg-panel p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-impact text-xl uppercase">Notify me</h3>
            <p className="mt-1 text-sm text-muted">Gone for now. Want it back? We&apos;ll email you.</p>
            {notifyState?.ok ? (
              <p className="mt-4 text-sm text-lime">{notifyState.message}</p>
            ) : (
              <form action={notifyAction} className="mt-4">
                <input type="hidden" name="variantId" value={variant?.id ?? ""} />
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="you@email.com"
                  className="w-full border border-line-2 bg-ink px-3.5 py-2.5 outline-none focus:border-lime"
                />
                {notifyState && !notifyState.ok && (
                  <p className="mt-1.5 text-[12px] text-error">{notifyState.message}</p>
                )}
                <Button className="mt-3 w-full" arrow={false} type="submit" loading={notifyPending}>
                  Notify me
                </Button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
