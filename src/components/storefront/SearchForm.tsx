"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useSearchSuggestions } from "@/lib/use-search-suggestions";
import { formatTaka } from "@/lib/money";

export function SearchForm({ initialQuery }: { initialQuery: string }) {
  const [q, setQ] = useState(initialQuery);
  const [focused, setFocused] = useState(false);
  const router = useRouter();
  const suggestions = useSearchSuggestions(q);

  return (
    <div className="relative my-4">
      <form
        className="flex gap-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          router.push(`/search?q=${encodeURIComponent(q.trim())}`);
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder="Search products…"
          className="flex-1 border border-line-2 bg-panel px-3.5 py-3 outline-none focus:border-lime"
        />
        <Button size="sm" type="submit" arrow={false}>
          Go
        </Button>
      </form>
      {focused && suggestions.length > 0 && (
        <div className="absolute inset-x-0 top-full z-20 border border-line-2 border-t-0 bg-panel">
          {suggestions.map((s) => (
            <Link
              key={s.slug}
              href={`/product/${s.slug}`}
              className="flex justify-between border-b border-line px-3.5 py-2.5 text-sm last:border-0 hover:text-lime"
            >
              <span>{s.title}</span>
              <span className="price text-lime">{formatTaka(s.price)}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
