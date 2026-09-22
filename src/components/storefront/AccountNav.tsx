"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { customerLogout } from "@/actions/customer-auth";

const LINKS = [
  { href: "/account", label: "Profile" },
  { href: "/account/orders", label: "Orders" },
  { href: "/account/returns", label: "Returns" },
  { href: "/account/wishlist", label: "Wishlist" },
  { href: "/account/addresses", label: "Addresses" },
  { href: "/account/back-in-stock", label: "Back-in-stock" },
];

export function AccountNav() {
  const pathname = usePathname();
  return (
    <nav>
      {LINKS.map((l) => {
        const active = pathname === l.href;
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`block border-b border-line py-2.5 font-label text-base tracking-[1.2px] ${active ? "text-lime" : "text-muted hover:text-paper"}`}
          >
            {l.label}
          </Link>
        );
      })}
      <form action={customerLogout}>
        <button className="mt-2.5 font-label text-[13px] tracking-[1px] text-muted hover:text-error">Log out</button>
      </form>
    </nav>
  );
}
