"use client";

import { usePathname } from "next/navigation";
import { adminLogout } from "@/actions/admin-auth";

const TITLES: [string, string][] = [
  ["/admin/dashboard", "Dashboard"],
  ["/admin/orders", "Orders"],
  ["/admin/products/new", "New product"],
  ["/admin/products", "Products"],
  ["/admin/inventory", "Inventory"],
  ["/admin/categories", "Categories & collections"],
  ["/admin/customers", "Customers"],
  ["/admin/discounts", "Discounts"],
  ["/admin/campaigns", "Campaigns"],
  ["/admin/content", "Content CMS"],
  ["/admin/analytics", "Analytics"],
  ["/admin/reviews", "Reviews"],
  ["/admin/settings", "Settings"],
];

function titleFor(pathname: string): string {
  const match = TITLES.find(([prefix]) => pathname === prefix || pathname.startsWith(prefix + "/"));
  return match?.[1] ?? "Admin";
}

export function AdminTopbar({ name }: { name: string }) {
  const pathname = usePathname();
  const today = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <div className="sticky top-0 z-20 flex items-center gap-3.5 border-b border-line bg-ink/94 px-6.5 py-3.5 backdrop-blur-sm">
      <h1 className="font-impact text-2xl uppercase tracking-[0.5px]">{titleFor(pathname)}</h1>
      <div className="ml-auto flex items-center gap-3 text-sm text-muted">
        <span>{today}</span>
        <span>·</span>
        <span>{name}</span>
        <form action={adminLogout}>
          <button className="font-label text-[13px] tracking-[1px] text-muted hover:text-error">LOG OUT</button>
        </form>
      </div>
    </div>
  );
}
