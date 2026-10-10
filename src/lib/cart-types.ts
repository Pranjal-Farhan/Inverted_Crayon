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
  /** Per-unit advance due now when isPreorder — 0 means "reserve free, all due on delivery". Null when not a preorder line. */
  preorderAdvanceAmount: number | null;
  /** Product-level shipping override, snapshotted when this line was added — null means "use the store's default rate for that zone". See resolveShippingCost() in src/lib/shipping.ts. */
  deliveryChargeInsideDhaka: number | null;
  deliveryChargeOutsideDhaka: number | null;
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

/** Short cart/drawer note for a preorder line — no payment breakdown shown or implied; a sales agent follows up on the specifics. */
export function preorderLineNote(): string {
  return "Preorder Now and Our Sales Agent Will Reach Out";
}
