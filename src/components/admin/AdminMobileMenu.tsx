"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Monogram } from "@/components/brand/Monogram";
import { AdminNav } from "@/components/admin/AdminNav";
import type { AdminRole } from "@/lib/admin-areas";

/**
 * The admin's menu on phones and tablets, where the sidebar is hidden: a menu button in the top bar
 * that slides the same section list in from the left. It closes on a tap outside, on Escape, on
 * choosing a section, and by itself whenever the page changes (back button included) — the open
 * state remembers which page it was opened on, so there's no effect that has to reset it.
 */
export function AdminMobileMenu({ name, role }: { name: string; role: AdminRole }) {
  const pathname = usePathname();
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === pathname;
  const closeRef = useRef<HTMLButtonElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);

  function close() {
    setOpenAt(null);
    menuBtnRef.current?.focus();
  }

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden"; // the page underneath shouldn't scroll while the menu is up
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenAt(null);
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="desktop:hidden">
      <button
        ref={menuBtnRef}
        type="button"
        onClick={() => setOpenAt(pathname)}
        aria-label="Open menu"
        aria-expanded={open}
        aria-controls="admin-menu"
        className="grid h-10 w-10 shrink-0 place-items-center border border-line-2 hover:border-lime"
      >
        <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" aria-hidden="true">
          <path d="M4 7 H20 M4 12 H20 M4 17 H14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" fill="none" />
        </svg>
      </button>

      {/* Portalled to <body>: the top bar has a backdrop blur, which makes it the containing block of
          anything `position: fixed` inside it — rendered in place, the drawer would be clipped to the
          bar's height instead of covering the screen. `open` only turns true after a tap, so
          document is always there by then. */}
      {open &&
        createPortal(
        <div id="admin-menu" role="dialog" aria-modal="true" aria-label="Admin menu" className="fixed inset-0 z-[60] desktop:hidden">
          <div className="admin-menu-fade absolute inset-0 bg-black/65" onClick={close} aria-hidden="true" />
          <div className="admin-menu-slide absolute left-0 top-0 flex h-full w-[min(290px,86vw)] flex-col overflow-y-auto border-r border-line bg-[#0e0e10] pb-6 shadow-[0_0_50px_rgba(0,0,0,.6)]">
            <div className="flex items-center gap-2.5 border-b border-line px-4.5 py-3.5">
              <Monogram className="h-[22px] w-[26px]" />
              <b className="font-scrawl text-[15px]">Admin</b>
              <button
                ref={closeRef}
                type="button"
                onClick={close}
                aria-label="Close menu"
                className="ml-auto grid h-9 w-9 place-items-center border border-line-2 hover:border-lime"
              >
                <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
                  <path d="M6 6 L18 18 M18 6 L6 18" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" fill="none" />
                </svg>
              </button>
            </div>
            <div className="border-b border-line px-4.5 py-2.5 text-[13px] text-muted">
              Signed in as <span className="text-paper">{name}</span>{" "}
              <span className="font-label tracking-[1px] text-lime">· {role === "ADMIN" ? "ADMIN" : "STAFF"}</span>
            </div>
            <AdminNav role={role} onNavigate={close} />
            <Link href="/" className="text-muted-2 mt-3 block px-4.5 py-2.5 text-sm">
              ← Back to store
            </Link>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
