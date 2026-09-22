"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CATEGORIES } from "@/lib/categories";

export function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (open) inputRef.current?.focus();
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
