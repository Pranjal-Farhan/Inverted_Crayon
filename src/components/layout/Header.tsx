"use client";

import Link from "next/link";
import { useState } from "react";
import { Monogram } from "@/components/brand/Monogram";
import { RainbowWord } from "@/components/brand/RainbowWord";
import { CATEGORIES } from "@/lib/categories";
import { useCart } from "@/context/cart-context";
import { SearchOverlay } from "@/components/layout/SearchOverlay";
import { ScribbleLink } from "@/components/ui/ScribbleLink";

const GENDERS = [
  { key: "men", label: "Men" },
  { key: "women", label: "Women" },
] as const;

export function Header({
  saleActive,
  customerName,
  brandName = "Inverted Crayon",
  logoImageUrl = null,
}: {
  saleActive: boolean;
  customerName: string | null;
  brandName?: string;
  logoImageUrl?: string | null;
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileAccordion, setMobileAccordion] = useState<string | null>(null);
  const { count, openDrawer } = useCart();
  const [brandFirst, ...brandRest] = brandName.split(" ");
  const brandRestText = brandRest.join(" ");

  return (
    <>
      <header className="site-hd sticky top-0 z-[80] border-b border-line bg-ink/94 backdrop-blur-sm">
        <div className="wrap flex h-[66px] items-center gap-6">
          <Link href="/" className="flex shrink-0 items-center gap-2.5 transition-opacity hover:opacity-80">
            {logoImageUrl ? (
              <img src={logoImageUrl} alt={brandName} className="h-[34px] w-auto object-contain" />
            ) : (
              <>
                <Monogram className="h-[26px] w-[30px]" />
                <span className="font-scrawl text-[19px] uppercase leading-[0.85] text-paper">
                  {brandFirst}
                  {brandRestText && (
                    <small className="block text-[13px]">
                      <RainbowWord text={brandRestText} />
                    </small>
                  )}
                </span>
              </>
            )}
          </Link>

          <nav className="desktop:flex hidden flex-1 gap-5">
            {GENDERS.map((g) => (
              <div key={g.key} className="group relative">
                <Link
                  href={`/${g.key}`}
                  className="inline-flex items-center gap-1 py-2 font-label text-[17px] tracking-[1.4px] hover:text-lime"
                >
                  {g.label.toUpperCase()}
                  <span className="inline-block transition-transform duration-200 group-hover:rotate-180">▾</span>
                </Link>
                <div className="pointer-events-none absolute left-[-20px] top-full z-[90] min-w-[440px] -translate-y-1.5 border border-line-2 bg-[#0e0e10] p-[18px_22px] opacity-0 transition-all duration-200 ease-out group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100">
                  <div className="mb-2.5 font-label text-[13px] tracking-[1.5px] text-muted">
                    {g.label.toUpperCase()} · SHOP BY CATEGORY
                  </div>
                  <div className="grid grid-cols-2 gap-x-[22px] gap-y-1">
                    {CATEGORIES.map((c) => (
                      <Link
                        key={c.slug}
                        href={`/${g.key}/${c.slug}`}
                        className="py-1.5 text-sm text-[#ddd] hover:text-lime"
                      >
                        {c.name}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            ))}
            <ScribbleLink href="/new" stroke="var(--color-ic-yellow)" className="py-2 font-label text-[17px] tracking-[1.4px] hover:text-lime">
              NEW
            </ScribbleLink>
            <ScribbleLink href="/sale" stroke="var(--color-ic-pink)" className="py-2 font-label text-[17px] tracking-[1.4px] hover:text-lime">
              SALE {saleActive && <span className="text-pink animate-pulse">●</span>}
            </ScribbleLink>
            <ScribbleLink href="/lookbook" stroke="var(--color-ic-cyan)" className="py-2 font-label text-[17px] tracking-[1.4px] hover:text-lime">
              LOOKBOOK
            </ScribbleLink>
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-4">
            <button
              onClick={() => setSearchOpen(true)}
              aria-label="Search"
              className="desktop:block hidden"
            >
              <SearchIcon />
            </button>
            <Link href={customerName ? "/account" : "/account/login"} aria-label="Account">
              <AccountIcon />
            </Link>
            <button onClick={openDrawer} aria-label="Cart" className="relative">
              <CartIcon />
              {count > 0 && (
                <span className="absolute -right-2 -top-1.5 grid h-4 w-4 place-items-center rounded-full bg-lime font-label text-[11px] text-ink">
                  {count}
                </span>
              )}
            </button>
            <button
              className="desktop:hidden block"
              aria-label="Menu"
              onClick={() => setMobileOpen(true)}
            >
              <MenuIcon />
            </button>
          </div>
        </div>
      </header>

      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* mobile drawer */}
      <div
        className={`fixed inset-0 z-[220] bg-black/60 desktop:hidden transition-opacity ${
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setMobileOpen(false)}
      />
      <aside
        className={`fixed left-0 top-0 z-[225] h-full w-[85vw] max-w-[360px] overflow-y-auto bg-panel transition-transform desktop:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <Monogram className="h-[22px] w-[26px]" />
          <button onClick={() => setMobileOpen(false)} aria-label="Close menu" className="text-2xl text-muted">
            ×
          </button>
        </div>
        <div className="px-5 py-3">
          {GENDERS.map((g) => (
            <div key={g.key} className="border-b border-line">
              <button
                className="flex w-full items-center justify-between py-3 font-label text-lg tracking-[1.2px]"
                onClick={() => setMobileAccordion((a) => (a === g.key ? null : g.key))}
              >
                {g.label.toUpperCase()} <span>{mobileAccordion === g.key ? "−" : "+"}</span>
              </button>
              {mobileAccordion === g.key && (
                <div className="grid grid-cols-2 gap-2 pb-3">
                  {CATEGORIES.map((c) => (
                    <Link
                      key={c.slug}
                      href={`/${g.key}/${c.slug}`}
                      onClick={() => setMobileOpen(false)}
                      className="py-1 text-sm text-[#ddd]"
                    >
                      {c.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
          <Link href="/new" onClick={() => setMobileOpen(false)} className="block border-b border-line py-3 font-label text-lg tracking-[1.2px]">
            NEW
          </Link>
          <Link href="/sale" onClick={() => setMobileOpen(false)} className="block border-b border-line py-3 font-label text-lg tracking-[1.2px]">
            SALE {saleActive && <span className="text-pink animate-pulse">●</span>}
          </Link>
          <Link href="/lookbook" onClick={() => setMobileOpen(false)} className="block border-b border-line py-3 font-label text-lg tracking-[1.2px]">
            LOOKBOOK
          </Link>
          <Link
            href={customerName ? "/account" : "/account/login"}
            onClick={() => setMobileOpen(false)}
            className="block border-b border-line py-3 font-label text-lg tracking-[1.2px]"
          >
            {customerName ? "ACCOUNT" : "LOGIN"}
          </Link>
          <button
            onClick={() => {
              setMobileOpen(false);
              setSearchOpen(true);
            }}
            className="block w-full py-3 text-left font-label text-lg tracking-[1.2px]"
          >
            SEARCH
          </button>
        </div>
      </aside>
    </>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[21px] w-[21px]" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}
function AccountIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[21px] w-[21px]" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
    </svg>
  );
}
function CartIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[21px] w-[21px]" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 4h2l2.5 12h11L21 7H6" />
      <circle cx="9" cy="20" r="1.3" />
      <circle cx="18" cy="20" r="1.3" />
    </svg>
  );
}
function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 6h18M3 12h18M3 18h18" />
    </svg>
  );
}
