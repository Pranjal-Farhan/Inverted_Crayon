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
 * Whether a stored image URL is something that can be shared as a link at all. A placeholder frame
 * has an empty URL, and the oldest uploads were stored inline as `data:` Base64 — a multi-hundred-KB
 * string that isn't a link anyone could open (ARCHITECTURE.md §12).
 */
function isShareable(url: string): boolean {
  const u = url.trim();
  return u !== "" && !u.startsWith("data:");
}

/**
 * The address to copy. Every current upload is an absolute ImgBB address (https://i.ibb.co/…) and is
 * copied exactly as stored; the oldest uploads were kept on this site's own disk (/uploads/…), which
 * only becomes a usable link once it has the site's address in front of it. Called from the click
 * handler, never during render, because it needs the browser's `window`.
 */
function linkFor(url: string): string {
  const u = url.trim();
  if (/^https?:\/\//i.test(u)) return u;
  try {
    return new URL(u, window.location.origin).href;
  } catch {
    return u;
  }
}

/**
 * "Copy link" button for ONE uploaded product image: puts that image's own address on the clipboard
 * and says so ("Copied ✓") for a couple of seconds. It sits directly under the image's tile in the
 * product editor, so a product with five photos has five of these, each copying its own photo's link.
 *
 * `position` is the photo's place in the gallery (1 = the cover) and only names the button for
 * screen readers. An image with no usable link shows a disabled "No link" instead, so the tiles
 * still line up.
 */
export function CopyImageLink({ url, position, total }: { url: string; position: number; total: number }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const name = `image ${position} of ${total}`;
  const size = "w-full px-1 py-1 text-[12px]";
  const base = `font-label inline-flex items-center justify-center gap-1 border leading-none tracking-[0.8px] transition-colors ${size}`;

  if (!isShareable(url)) {
    return (
      <button
        type="button"
        disabled
        aria-label={`No link for ${name}`}
        title="This photo has no public link — it's a placeholder frame or an old photo stored inside the database."
        className={`${base} cursor-not-allowed border-line text-muted-2`}
      >
        No link
      </button>
    );
  }

  async function copy() {
    const link = linkFor(url);
    if (!(await copyToClipboard(link))) {
      // Nothing could write to the clipboard: show the address so it can be copied by hand.
      window.prompt("Copy this link (Ctrl+C, then Enter):", link);
      return;
    }
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2200);
  }

  return (
    <>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy link to ${name}`}
        title={url}
        className={`${base} ${copied ? "border-lime text-lime" : "border-line-2 text-muted hover:border-lime hover:text-lime"}`}
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
        {copied ? `Link to ${name} copied.` : ""}
      </span>
    </>
  );
}
