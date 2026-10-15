"use client";

import { useState, useTransition } from "react";
import { addManufacturerLink, removeManufacturerLink, setCurrentVendor, type ManufacturerLinkRow } from "@/actions/admin-manufacturer-links";
import { manufacturerHref } from "@/lib/manufacturer-link";

/**
 * Admin-only notes on a product — rows of (usually) manufacturer page links, never shown to
 * customers. A normal click opens a row's link in a new tab; "Change current vendor" flips every
 * row into a picker for one turn, where clicking instead tags that row as the current vendor
 * (see admin-manufacturer-links.ts for why exactly one row can hold that flag at a time).
 */
export function ManufacturerLinksPanel({
  productId,
  initialLinks,
}: {
  productId: string | null;
  initialLinks: ManufacturerLinkRow[];
}) {
  const [links, setLinks] = useState<ManufacturerLinkRow[]>(initialLinks);
  const [newUrl, setNewUrl] = useState("");
  const [pickingVendor, setPickingVendor] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!productId) {
    return <p className="text-[13px] text-muted-2">Save the product first to add manufacturer links.</p>;
  }

  function handleAdd() {
    const url = newUrl.trim();
    if (!url) return;
    setError(null);
    setNewUrl("");
    startTransition(async () => {
      const res = await addManufacturerLink(productId!, url);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setLinks((prev) => [...prev, res.link]);
    });
  }

  function handleRemove(id: string) {
    setLinks((prev) => prev.filter((l) => l.id !== id));
    startTransition(async () => {
      const res = await removeManufacturerLink(id);
      if (!res.ok) setError(res.error);
    });
  }

  function handlePick(id: string) {
    setPickingVendor(false);
    setLinks((prev) => prev.map((l) => ({ ...l, isCurrentVendor: l.id === id })));
    startTransition(async () => {
      const res = await setCurrentVendor(productId!, id);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <div>
      {pickingVendor && (
        <p className="mb-2 text-[12px] text-cyan">Click a row below to make it the current vendor.</p>
      )}

      <div className="flex flex-col gap-1.5">
        {links.length === 0 && <p className="text-[13px] text-muted-2">No links yet.</p>}
        {links.map((link) => (
          <div key={link.id} className="flex items-center gap-2 border border-line-2 bg-ink px-2.5 py-1.5">
            {pickingVendor ? (
              <button
                type="button"
                onClick={() => handlePick(link.id)}
                className="min-w-0 flex-1 truncate text-left text-sm text-cyan hover:underline"
              >
                {link.url}
              </button>
            ) : manufacturerHref(link.url) ? (
              <a
                href={manufacturerHref(link.url)!}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 flex-1 truncate text-sm text-[#ddd] hover:text-lime hover:underline"
              >
                {link.url}
              </a>
            ) : (
              <span className="min-w-0 flex-1 truncate text-sm text-[#ddd]">{link.url}</span>
            )}
            {link.isCurrentVendor && (
              // Reuses globals.css's .preorder-blink keyframe (already neutralized under
              // prefers-reduced-motion) rather than adding a near-duplicate animation.
              <span className="preorder-blink shrink-0 bg-lime/[0.16] px-1.5 py-0.5 font-label text-[10px] tracking-[1px] text-lime">
                CURRENT VENDOR
              </span>
            )}
            <button
              type="button"
              onClick={() => handleRemove(link.id)}
              aria-label="Remove link"
              className="shrink-0 text-muted hover:text-error"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="mt-2.5 flex gap-2">
        <input
          value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
          placeholder="https://manufacturer.example.com/page"
          className="w-full border border-line-2 bg-ink px-3 py-2 text-sm outline-none focus:border-lime"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={pending}
          className="shrink-0 border border-line-2 px-3 py-2 text-sm hover:border-lime disabled:opacity-50"
        >
          Add row
        </button>
      </div>

      <button
        type="button"
        onClick={() => setPickingVendor((v) => !v)}
        className={`mt-2.5 w-full border px-3 py-2 text-sm ${
          pickingVendor ? "border-cyan text-cyan" : "border-line-2 hover:border-lime"
        }`}
      >
        {pickingVendor ? "Cancel" : "Change current vendor"}
      </button>

      {error && <p className="mt-2 text-[13px] text-error">{error}</p>}
    </div>
  );
}
