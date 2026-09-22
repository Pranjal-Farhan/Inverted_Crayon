export type CartLine = {
  variantId: string;
  productId: string;
  slug: string;
  title: string;
  size: string;
  color: string;
  colorHex: string | null;
  accentColor: string | null;
  unitPrice: number;
  qty: number;
  isPreorder: boolean;
  preorderShipDate: string | null;
  maxQty: number;
};

export type Cart = {
  lines: CartLine[];
  promoCode: string | null;
};

export const EMPTY_CART: Cart = { lines: [], promoCode: null };

export function cartCount(cart: Cart): number {
  return cart.lines.reduce((sum, l) => sum + l.qty, 0);
}

export function cartSubtotal(cart: Cart): number {
  return cart.lines.reduce((sum, l) => sum + l.qty * l.unitPrice, 0);
}

export function cartHasPreorder(cart: Cart): boolean {
  return cart.lines.some((l) => l.isPreorder);
}

export function cartHasInStock(cart: Cart): boolean {
  return cart.lines.some((l) => !l.isPreorder);
}
