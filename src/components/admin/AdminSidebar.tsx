"use client";

import Link from "next/link";
import { Monogram } from "@/components/brand/Monogram";
import { AdminNav } from "@/components/admin/AdminNav";
import type { AdminRole } from "@/lib/admin-areas";

/** The desktop sidebar. On phones it's hidden and AdminMobileMenu (in the top bar) takes over. */
export function AdminSidebar({ role }: { role: AdminRole }) {
  return (
    <aside className="sticky top-0 hidden h-screen w-[220px] shrink-0 overflow-auto border-r border-line bg-[#0e0e10] py-4.5 desktop:block">
      <div className="mb-2.5 flex items-center gap-2.5 border-b border-line px-4.5 pb-4">
        <Monogram className="h-[22px] w-[26px]" />
        <b className="font-scrawl text-[15px]">Admin</b>
      </div>
      <AdminNav role={role} />
      <Link href="/" className="text-muted-2 mt-3 block px-4.5 py-2.5 text-sm">
        ← Back to store
      </Link>
    </aside>
  );
}
