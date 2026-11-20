/** Tag pill — one look per tag type, used on cards, PDP, and admin lists (§05). */
export type TagKind =
  | "preorder"
  /** Out of stock, but still sold as a preorder — the small tag that replaces darkening the photo. */
  | "preorder-open"
  | "new"
  | "sale"
  | "limited"
  | "bestseller"
  | "soldout"
  | "back-in-stock";

const LABEL: Record<TagKind, string> = {
  preorder: "Preorder",
  "preorder-open": "Out of stock · Open to preorder",
  new: "New",
  sale: "Sale",
  limited: "Limited",
  bestseller: "Bestseller",
  soldout: "Out of stock",
  "back-in-stock": "Back in stock",
};

const CLASS: Record<TagKind, string> = {
  preorder: "bg-yellow text-ink",
  "preorder-open": "bg-yellow text-ink",
  new: "bg-pink text-ink",
  sale: "bg-error text-ink",
  limited: "bg-cyan text-ink",
  bestseller: "bg-lime text-ink",
  // Solid, not transparent: these sit directly on a product photo (the photo is no longer dimmed
  // behind them), so they have to read on any picture.
  soldout: "border border-line-2 bg-ink text-paper",
  "back-in-stock": "border border-line-2 text-muted bg-transparent",
};

export function TagPill({ kind, className = "" }: { kind: TagKind; className?: string }) {
  // Two short lines rather than one long one, so it stays a small tag even on a phone's two-column grid.
  if (kind === "preorder-open") {
    return (
      <span className={`inline-block px-[9px] py-[3px] ${CLASS[kind]} ${className}`}>
        <span className="block font-label text-[10px] leading-[11px] tracking-[0.9px] opacity-75">Out of stock</span>
        <span className="block font-label text-[12px] leading-[14px] tracking-[0.7px]">Open to preorder</span>
      </span>
    );
  }
  const glitch = kind === "sale";
  return (
    <span
      className={`inline-block font-label text-[12px] tracking-[0.7px] px-[9px] py-[2px] ${CLASS[kind]} ${glitch ? "glitch-text relative" : ""} ${className}`}
      data-text={glitch ? LABEL[kind] : undefined}
    >
      {LABEL[kind]}
    </span>
  );
}
