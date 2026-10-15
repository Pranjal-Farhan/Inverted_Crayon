"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  ["/admin/finance", "Overview"],
  ["/admin/finance/sales", "Sales"],
  ["/admin/finance/expenses", "Expenses"],
  ["/admin/finance/investments", "Investments"],
  ["/admin/finance/statement", "Statement"],
  ["/admin/finance/stock", "Stock & owners"],
] as const;

export function FinanceNav() {
  const pathname = usePathname();
  return (
    <nav className="mb-4.5 flex gap-1 overflow-x-auto border-b border-line print:hidden" aria-label="Finance sections">
      {TABS.map(([href, label]) => {
        const active = href === "/admin/finance" ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            prefetch={false}
            aria-current={active ? "page" : undefined}
            className={`font-label -mb-px whitespace-nowrap border-b-2 px-3.5 py-2.5 text-[14px] tracking-[0.8px] ${
              active ? "border-lime text-lime" : "border-transparent text-muted hover:text-paper"
            }`}
          >
            {label.toUpperCase()}
          </Link>
        );
      })}
    </nav>
  );
}
