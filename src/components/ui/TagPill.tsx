/** Tag pill — one look per tag type, used on cards, PDP, and admin lists (§05). */
export type TagKind = "preorder" | "new" | "sale" | "limited" | "bestseller" | "soldout" | "back-in-stock";

const LABEL: Record<TagKind, string> = {
  preorder: "Preorder",
  new: "New",
  sale: "Sale",
  limited: "Limited",
  bestseller: "Bestseller",
  soldout: "Sold out",
  "back-in-stock": "Back in stock",
};

const CLASS: Record<TagKind, string> = {
  preorder: "bg-yellow text-ink",
  new: "bg-pink text-ink",
  sale: "bg-error text-ink",
  limited: "bg-cyan text-ink",
  bestseller: "bg-lime text-ink",
  soldout: "border border-line-2 text-muted bg-transparent",
  "back-in-stock": "border border-line-2 text-muted bg-transparent",
};

export function TagPill({ kind, className = "" }: { kind: TagKind; className?: string }) {
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
