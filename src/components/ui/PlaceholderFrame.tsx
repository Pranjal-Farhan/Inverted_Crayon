import { Monogram } from "@/components/brand/Monogram";
import { Scribble } from "@/components/brand/Scribble";

/**
 * Styled placeholder well standing in for product/model photography.
 * Real photography drops into the same frame at the same aspect ratio
 * (Build Spec — "Assets" note, §00 / §06). Every product image in this
 * build is one of these until real shots are uploaded via Admin.
 */
export function PlaceholderFrame({
  accentColor = "#ff2d84",
  shape = "x",
  label,
  soldOut = false,
  soldOutLabel = "SOLD OUT",
  stamp = true,
  className = "",
}: {
  accentColor?: string;
  shape?: "x" | "circle" | "square" | "underline" | "arrow";
  label?: string;
  soldOut?: boolean;
  /** Overlay text shown when soldOut — override to "PREORDER" when the item can still be reserved. */
  soldOutLabel?: string;
  stamp?: boolean;
  className?: string;
}) {
  return (
    <div className={`relative overflow-hidden bg-panel ${className}`}>
      <Scribble shape={shape} color={accentColor} className="absolute inset-0 h-full w-full" />
      {stamp && (
        <Monogram className="absolute right-2 top-2 z-[4] h-[22px] w-[26px] opacity-90" minimal />
      )}
      {label && (
        <span className="absolute bottom-2 left-2 z-[3] font-label text-[12px] tracking-[1.4px] text-muted-2">
          {label}
        </span>
      )}
      {soldOut && (
        <div className="absolute inset-0 z-[5] grid place-items-center bg-[rgba(8,8,9,.55)]">
          <span className="font-impact text-[22px] tracking-[2px] text-paper">{soldOutLabel}</span>
        </div>
      )}
    </div>
  );
}
