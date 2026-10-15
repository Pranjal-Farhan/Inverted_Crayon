"use client";

import { usePathname } from "next/navigation";
import { adminLogout } from "@/actions/admin-auth";
import { AdminMobileMenu } from "@/components/admin/AdminMobileMenu";
import type { AdminRole } from "@/lib/admin-areas";

const TITLES: [string, string][] = [
  ["/admin/dashboard", "Dashboard"],
  ["/admin/orders", "Orders"],
  ["/admin/products/new", "New product"],
  ["/admin/products", "Products"],
  ["/admin/categories", "Categories"],
  ["/admin/customers", "Customers"],
  ["/admin/discounts", "Discounts"],
  ["/admin/content", "Content CMS"],
  ["/admin/analytics", "Analytics"],
  ["/admin/emails", "Emails"],
  ["/admin/templates", "Message templates"],
  ["/admin/settings", "Settings"],
];

function titleFor(pathname: string): string {
  const match = TITLES.find(([prefix]) => pathname === prefix || pathname.startsWith(prefix + "/"));
  return match?.[1] ?? "Admin";
}

export function AdminTopbar({ name, role }: { name: string; role: AdminRole }) {
  const pathname = usePathname();
  const today = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-ink/94 px-4 py-3 backdrop-blur-sm desktop:gap-3.5 desktop:px-6.5 desktop:py-3.5">
      <AdminMobileMenu name={name} role={role} />
      <h1 className="min-w-0 truncate font-impact text-xl uppercase tracking-[0.5px] desktop:text-2xl">{titleFor(pathname)}</h1>
      <div className="ml-auto flex shrink-0 items-center gap-3 text-sm text-muted">
        <span className="hidden desktop:inline">{today}</span>
        <span className="hidden desktop:inline">·</span>
        <span className="hidden desktop:inline">{name}</span>
        <form action={adminLogout}>
          <button className="font-label text-[13px] tracking-[1px] text-muted hover:text-error">LOG OUT</button>
        </form>
      </div>
    </div>
  );
}
