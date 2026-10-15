"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { canAccessArea, type AdminArea, type AdminRole } from "@/lib/admin-areas";

type NavItem = { href: string; label: string; icon: string; area: AdminArea };

const NAV: { group: string; items: NavItem[] }[] = [
  { group: "Overview", items: [{ href: "/admin/dashboard", label: "Dashboard", icon: "◧", area: "dashboard" }] },
  {
    group: "Sell",
    items: [
      { href: "/admin/orders", label: "Orders", icon: "▤", area: "orders" },
      { href: "/admin/products", label: "Products", icon: "▦", area: "products" },
      { href: "/admin/finance", label: "Finance", icon: "৳", area: "finance" },
      { href: "/admin/categories", label: "Categories", icon: "☰", area: "categories" },
      { href: "/admin/size-guides", label: "Size guides", icon: "▭", area: "size-guides" },
    ],
  },
  {
    group: "Grow",
    items: [
      { href: "/admin/customers", label: "Customers", icon: "☺", area: "customers" },
      { href: "/admin/discounts", label: "Discounts", icon: "%", area: "discounts" },
      { href: "/admin/content", label: "Content CMS", icon: "▥", area: "content" },
      { href: "/admin/footer", label: "Footer", icon: "▤", area: "footer" },
      { href: "/admin/analytics", label: "Analytics", icon: "◧", area: "analytics" },
    ],
  },
  {
    group: "System",
    items: [
      { href: "/admin/emails", label: "Emails", icon: "✉", area: "emails" },
      { href: "/admin/templates", label: "Templates", icon: "✎", area: "templates" },
      { href: "/admin/settings", label: "Settings", icon: "⚙", area: "security" },
    ],
  },
];

/**
 * The admin's section links, shared by the desktop sidebar and the phone menu drawer so the two can
 * never drift apart. Staff only see what they may use; a group with nothing left in it disappears.
 * For staff the Settings entry only holds their own two-factor setup, so it says so.
 */
export function AdminNav({ role, onNavigate }: { role: AdminRole; onNavigate?: () => void }) {
  const pathname = usePathname();
  const groups = NAV.map((g) => ({
    ...g,
    items: g.items
      .filter((item) => canAccessArea(role, item.area))
      .map((item) => (role === "STAFF" && item.href === "/admin/settings" ? { ...item, label: "My security" } : item)),
  })).filter((g) => g.items.length > 0);

  return (
    <>
      {groups.map((g) => (
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
                prefetch={false}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
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
    </>
  );
}
