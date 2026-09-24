"use client";

import Link from "next/link";
import type { ButtonHTMLAttributes, PointerEvent, ReactNode } from "react";
import { useRef } from "react";
import { Scribble } from "@/components/brand/Scribble";

type Variant = "primary" | "ghost" | "text";
type Size = "md" | "sm";

type CommonProps = {
  variant?: Variant;
  size?: Size;
  href?: string;
  arrow?: boolean;
  loading?: boolean;
  className?: string;
  children: ReactNode;
};

type ButtonProps = CommonProps & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">;

const base =
  "inline-flex items-center justify-center gap-3 font-impact tracking-[0.6px] transition disabled:opacity-40 disabled:pointer-events-none";

const variantClass: Record<Variant, string> = {
  primary: "btn-primary bg-lime text-ink hover:bg-[#d3ff4f]",
  ghost: "bg-ink text-paper border border-line-2 hover:border-lime",
  text: "bg-transparent text-cyan hover:underline p-0 font-body font-medium tracking-normal normal-case",
};

const sizeClass: Record<Size, string> = {
  md: "text-base px-6 py-3",
  sm: "text-[13px] px-4 py-2",
};

const glowClass: Record<Variant, string> = {
  primary: "magnet-glow mg-primary",
  ghost: "magnet-glow mg-ghost",
  text: "",
};

const SCRIBBLE_COLORS = ["#c3f53a", "#ff2d84", "#26a7e6", "#ffd23b"];

// Deterministic per-button hash — same button always gets the same scribble kind/color
// (no hydration mismatch, no re-roll on re-render), but different buttons vary.
function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

function pickScribble(seed: string): { kind: "underline" | "oval"; color: string } {
  const h = hashSeed(seed);
  return {
    kind: h % 3 === 0 ? "oval" : "underline",
    color: SCRIBBLE_COLORS[h % SCRIBBLE_COLORS.length],
  };
}

function Content({ children, arrow, loading }: { children: ReactNode; arrow?: boolean; loading?: boolean }) {
  return (
    <>
      {children}
      {loading ? (
        <span aria-hidden className="inline-block h-3 w-3 animate-spin border-2 border-current border-t-transparent" />
      ) : (
        arrow && <Scribble shape="arrow" color="currentColor" className="h-[13px] w-[18px]" />
      )}
    </>
  );
}

export function Button({
  variant = "primary",
  size = "md",
  href,
  arrow = variant !== "text",
  loading = false,
  className = "",
  children,
  ...rest
}: ButtonProps) {
  const magnetic = variant !== "text" && !loading && !rest.disabled;
  const hasScribble = variant !== "text";
  const scribble = hasScribble
    ? pickScribble(`${variant}:${href ?? (typeof children === "string" ? children : "btn")}`)
    : null;
  const classes = `${base} ${variantClass[variant]} ${variant === "text" ? "" : sizeClass[size]} ${magnetic ? glowClass[variant] : ""} ${hasScribble ? "btn-scribble" : ""} ${className}`;
  const ref = useRef<HTMLElement>(null);

  // Pulls the button a few px toward the cursor and lets it spring back — the primary
  // variant's own hover lift is a CSS rotate(-1deg), which this preserves by folding it
  // into the same inline transform (an inline style otherwise overrides the CSS rule).
  function onPointerMove(e: PointerEvent) {
    if (!magnetic || e.pointerType !== "mouse") return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const mx = (e.clientX - (r.left + r.width / 2)) * 0.22;
    const my = (e.clientY - (r.top + r.height / 2)) * 0.28;
    el.style.transform = variant === "primary" ? `translate(${mx}px, ${my}px) rotate(-1deg)` : `translate(${mx}px, ${my}px)`;
  }
  function onPointerLeave() {
    if (ref.current) ref.current.style.transform = "";
  }

  const scribbleEl = scribble && (
    <Scribble
      shape={scribble.kind}
      color={scribble.color}
      className={scribble.kind === "oval" ? "btn-scribble-oval" : "btn-scribble-underline"}
    />
  );

  if (href) {
    return (
      <Link
        ref={ref as React.Ref<HTMLAnchorElement>}
        href={href}
        className={classes}
        onPointerMove={magnetic ? onPointerMove : undefined}
        onPointerLeave={magnetic ? onPointerLeave : undefined}
      >
        <Content arrow={arrow}>{children}</Content>
        {scribbleEl}
      </Link>
    );
  }

  return (
    <button
      ref={ref as React.Ref<HTMLButtonElement>}
      className={classes}
      disabled={loading || rest.disabled}
      onPointerMove={magnetic ? onPointerMove : undefined}
      onPointerLeave={magnetic ? onPointerLeave : undefined}
      {...rest}
    >
      <Content arrow={arrow} loading={loading}>
        {loading ? "…" : children}
      </Content>
      {scribbleEl}
    </button>
  );
}
