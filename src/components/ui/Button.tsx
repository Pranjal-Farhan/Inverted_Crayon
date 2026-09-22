import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
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
  const classes = `${base} ${variantClass[variant]} ${variant === "text" ? "" : sizeClass[size]} ${className}`;

  if (href) {
    return (
      <Link href={href} className={classes}>
        <Content arrow={arrow}>{children}</Content>
      </Link>
    );
  }

  return (
    <button className={classes} disabled={loading || rest.disabled} {...rest}>
      <Content arrow={arrow} loading={loading}>
        {loading ? "…" : children}
      </Content>
    </button>
  );
}
