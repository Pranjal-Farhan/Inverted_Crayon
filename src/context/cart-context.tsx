"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Cart, CartLine } from "@/lib/cart-types";
import { EMPTY_CART, cartCount, cartSubtotal } from "@/lib/cart-types";
import { useToast } from "@/context/toast-context";

const STORAGE_KEY = "ic_cart_v1";

type CartContextValue = {
  cart: Cart;
  count: number;
  subtotal: number;
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  addLine: (line: CartLine) => void;
  removeLine: (variantId: string) => void;
  setQty: (variantId: string, qty: number) => void;
  clearCart: () => void;
  setPromoCode: (code: string | null) => void;
  hydrated: boolean;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<Cart>(EMPTY_CART);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const { push } = useToast();

  // Reads from localStorage (an external system) to hydrate state after
  // mount — SSR has no access to it, so this can't move into useState.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setCart(JSON.parse(raw));
    } catch {
      // ignore corrupt storage
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // storage may be unavailable (private mode) — cart stays in-memory
    }
  }, [cart, hydrated]);

  const addLine = useCallback(
    (line: CartLine) => {
      setCart((prev) => {
        const existing = prev.lines.find((l) => l.variantId === line.variantId);
        if (existing) {
          const nextQty = Math.min(existing.qty + line.qty, line.maxQty);
          return {
            ...prev,
            lines: prev.lines.map((l) =>
              l.variantId === line.variantId ? { ...l, qty: nextQty } : l,
            ),
          };
        }
        return { ...prev, lines: [...prev.lines, line] };
      });
      push(`Added to bag — ${line.title}`);
      setDrawerOpen(true);
    },
    [push],
  );

  const removeLine = useCallback((variantId: string) => {
    setCart((prev) => ({ ...prev, lines: prev.lines.filter((l) => l.variantId !== variantId) }));
  }, []);

  const setQty = useCallback((variantId: string, qty: number) => {
    setCart((prev) => ({
      ...prev,
      lines: prev.lines
        .map((l) => (l.variantId === variantId ? { ...l, qty: Math.min(Math.max(qty, 1), l.maxQty) } : l))
        .filter((l) => l.qty > 0),
    }));
  }, []);

  const clearCart = useCallback(() => setCart(EMPTY_CART), []);
  const setPromoCode = useCallback((code: string | null) => {
    setCart((prev) => ({ ...prev, promoCode: code }));
  }, []);

  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      count: cartCount(cart),
      subtotal: cartSubtotal(cart),
      drawerOpen,
      openDrawer: () => setDrawerOpen(true),
      closeDrawer: () => setDrawerOpen(false),
      addLine,
      removeLine,
      setQty,
      clearCart,
      setPromoCode,
      hydrated,
    }),
    [cart, drawerOpen, addLine, removeLine, setQty, clearCart, setPromoCode, hydrated],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
