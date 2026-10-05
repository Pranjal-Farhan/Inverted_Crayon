"use client";

import { useEffect, useState } from "react";

export type Suggestion = { title: string; slug: string; price: number };

// Module-level, so it's shared across every mount of the hook (e.g. closing and reopening the
// search overlay) rather than reset per-component — repeating an identical query within the
// session costs zero extra invocations.
const suggestionCache = new Map<string, Suggestion[]>();

export function useSearchSuggestions(query: string) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  // Debounced fetch-on-dependency-change, synchronizing with the server's search index as
  // `query` changes. 350ms debounce + an AbortController for the in-flight request (not just a
  // `cancelled` flag) so a fast typist's earlier keystrokes don't also leave a straggling
  // request running server-side after being superseded, and a small client cache so retyping an
  // already-seen query is instant and call-free.
  useEffect(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSuggestions([]);
      return;
    }
    const cached = suggestionCache.get(q);
    if (cached) {
      setSuggestions(cached);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/search/suggest?q=${encodeURIComponent(q)}`, { signal: controller.signal })
        .then((r) => r.json())
        .then((data: Suggestion[]) => {
          suggestionCache.set(q, data);
          setSuggestions(data);
        })
        .catch((e) => {
          if (e.name !== "AbortError") setSuggestions([]);
        });
    }, 350);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query]);

  return suggestions;
}
