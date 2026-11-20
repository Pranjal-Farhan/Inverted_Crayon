"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Puts `text` on the clipboard: the modern API first, then the old select-and-copy trick for
 * browsers that block it (an insecure address, an embedded page, a denied permission).
 * Resolves to whether either worked.
 */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* blocked — try the fallback below */
  }
  try {
    const box = document.createElement("textarea");
    box.value = text;
    box.setAttribute("readonly", "");
    box.style.position = "fixed";
    box.style.top = "0";
    box.style.opacity = "0";
    document.body.appendChild(box);
    box.select();
    box.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(box);
    return ok;
  } catch {
    return false;
  }
}

/**
 * "Copy link" button for one product: puts that product's public storefront address on the
 * clipboard and says so ("Copied ✓") for a couple of seconds.
 *
 * `tile` is the narrow version that sits under a product's thumbnail in the products list; `row` is
 * the roomier one next to the link in the editor. A Draft still copies — but its page shows "not
 * found" until the product is set to Active, so the copied state turns yellow and the tooltip and
 * screen-reader message say so.
 */
export function CopyProductLink({
  url,
  name,
  live,
  layout = "tile",
}: {
  /** The product's full public address (publicProductUrl). */
  url: string;
  /** The product's title — names the button for screen readers. */
  name: string;
  /** False for a Draft: the address 404s on the storefront until the product is Active. */
  live: boolean;
  layout?: "tile" | "row";
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  async function copy() {
    if (!(await copyToClipboard(url))) {
      // Nothing could write to the clipboard: show the address so it can be copied by hand.
      window.prompt("Copy this link (Ctrl+C, then Enter):", url);
      return;
    }
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2200);
  }

  const draftNote = "Draft — this link shows “not found” until the product is set to Active.";
  const tone = copied
    ? live
      ? "border-lime text-lime"
      : "border-yellow text-yellow"
    : "border-line-2 text-muted hover:border-lime hover:text-lime";
  const size = layout === "tile" ? "w-full px-1 py-1 text-[12px]" : "px-3 py-1.5 text-[14px]";

  return (
    <>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy public link for ${name}`}
        title={live ? url : `${url}\n${draftNote}`}
        className={`font-label inline-flex items-center justify-center gap-1 border leading-none tracking-[0.8px] transition-colors ${size} ${tone}`}
      >
        {!copied && (
          <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
        )}
        {copied ? "Copied ✓" : "Copy link"}
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? (live ? "Link copied." : `Link copied. ${draftNote}`) : ""}
      </span>
    </>
  );
}
