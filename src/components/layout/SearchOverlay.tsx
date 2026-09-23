"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CATEGORIES } from "@/lib/categories";
import { useSearchSuggestions } from "@/lib/use-search-suggestions";
import { formatTaka } from "@/lib/money";

export function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const suggestions = useSearchSuggestions(q);

  // Syncs local input state to the overlay's open/close prop (an external
  // trigger) — resetting the query when it closes.
  useEffect(() => {
    if (open) inputRef.current?.focus();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    else setQ("");
  }, [open]);

  if (!open) return null;

  function submit(query: string) {
    onClose();
    router.push(`/search?q=${encodeURIComponent(query)}`);
  }

  return (
    <div className="fixed inset-0 z-[210] bg-ink/97 backdrop-blur-sm">
      <div className="wrap flex items-center gap-4 border-b border-line py-5">
        <form
          className="flex flex-1 gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (q.trim()) submit(q.trim());
          }}
        >
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search products…"
            className="flex-1 border border-line-2 bg-panel px-4 py-3 text-lg outline-none focus:border-lime"
          />
        </form>
        <button onClick={onClose} aria-label="Close search" className="text-3xl leading-none text-muted hover:text-paper">
          ×
        </button>
      </div>
      <div className="wrap py-8">
        {suggestions.length > 0 ? (
          <>
            <p className="mb-3 font-label text-[13px] tracking-[1.4px] text-muted">SUGGESTIONS</p>
            <div className="mb-8 flex flex-col gap-1">
              {suggestions.map((s) => (
                <Link
                  key={s.slug}
                  href={`/product/${s.slug}`}
                  onClick={onClose}
                  className="flex justify-between border-b border-line py-2.5 hover:text-lime"
                >
                  <span>{s.title}</span>
                  <span className="price text-lime">{formatTaka(s.price)}</span>
                </Link>
              ))}
            </div>
          </>
        ) : (
          q.trim().length >= 2 && (
            <p className="mb-8 text-muted">
              No quick matches —{" "}
              <button onClick={() => submit(q.trim())} className="text-cyan hover:underline">
                see full results for &quot;{q}&quot;
              </button>
            </p>
          )
        )}
        <p className="mb-3 font-label text-[13px] tracking-[1.4px] text-muted">POPULAR CATEGORIES</p>
        <div className="flex flex-wrap gap-2.5">
          {CATEGORIES.map((c) => (
            <button
              key={c.slug}
              onClick={() => submit(c.name)}
              className="border border-line-2 px-3 py-1.5 text-sm hover:border-lime hover:text-lime"
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
