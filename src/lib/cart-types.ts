import { formatTaka } from "@/lib/money";

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

/** Short cart/drawer note for a preorder line: ship-date when the product carries one, else the standard window — plus the pay-now/on-delivery split. */
export function preorderLineNote(line: CartLine): string {
  const shipPart = line.preorderShipDate ? `ships ${line.preorderShipDate}` : "ships in 7–15 days";
  const advance = line.preorderAdvanceAmount ?? line.unitPrice;
  const payPart =
    advance > 0 ? `${formatTaka(advance)} now, ${formatTaka(line.unitPrice - advance)} on delivery` : "free to reserve, pay on delivery";
  return `Preorder — ${shipPart} · ${payPart}`;
}
