"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Monogram } from "@/components/brand/Monogram";

const NAV: { group: string; items: { href: string; label: string; icon: string }[] }[] = [
  { group: "Overview", items: [{ href: "/admin/dashboard", label: "Dashboard", icon: "◧" }] },
  {
    group: "Sell",
    items: [
      { href: "/admin/orders", label: "Orders", icon: "▤" },
      { href: "/admin/products", label: "Products", icon: "▦" },
      { href: "/admin/inventory", label: "Inventory", icon: "▣" },
      { href: "/admin/finance", label: "Finance", icon: "৳" },
      { href: "/admin/categories", label: "Categories", icon: "☰" },
    ],
  },
  {
    group: "Grow",
    items: [
      { href: "/admin/customers", label: "Customers", icon: "☺" },
      { href: "/admin/discounts", label: "Discounts", icon: "%" },
      { href: "/admin/campaigns", label: "Campaigns", icon: "◔" },
      { href: "/admin/content", label: "Content CMS", icon: "▥" },
      { href: "/admin/journal", label: "Journal", icon: "✎" },
      { href: "/admin/analytics", label: "Analytics", icon: "◧" },
      { href: "/admin/reviews", label: "Reviews", icon: "★" },
    ],
  },
  {
    group: "System",
    items: [
      { href: "/admin/emails", label: "Emails", icon: "✉" },
      { href: "/admin/sms", label: "SMS", icon: "☏" },
      { href: "/admin/settings", label: "Settings", icon: "⚙" },
    ],
  },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen w-[220px] shrink-0 overflow-auto border-r border-line bg-[#0e0e10] py-4.5 desktop:block">
      <div className="mb-2.5 flex items-center gap-2.5 border-b border-line px-4.5 pb-4">
        <Monogram className="h-[22px] w-[26px]" />
        <b className="font-scrawl text-[15px]">Admin</b>
      </div>
      {NAV.map((g) => (
        <div key={g.group}>
          <div className="font-label px-4.5 pb-1 pt-3.5 text-[12px] tracking-[1.4px] text-muted-2">
            {g.group.toUpperCase()}
          </div>
          {g.items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 border-l-[3px] px-4.5 py-2.5 text-sm ${
                  active ? "border-lime bg-[#141416] text-paper" : "border-transparent text-muted hover:bg-[#141416] hover:text-paper"
                }`}
              >
                <span aria-hidden>{item.icon}</span> {item.label}
              </Link>
            );
          })}
        </div>
      ))}
      <Link href="/" className="text-muted-2 mt-3 block px-4.5 py-2.5 text-sm">
        ← Back to store
      </Link>
    </aside>
  );
}
