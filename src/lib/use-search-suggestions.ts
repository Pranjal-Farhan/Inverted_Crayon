"use client";

import { useEffect, useState } from "react";

export type Suggestion = { title: string; slug: string; price: number };

export function useSearchSuggestions(query: string) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  // Debounced fetch-on-dependency-change, synchronizing with the server's
  // search index as `query` changes.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      fetch(`/api/search/suggest?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((data) => {
          if (!cancelled) setSuggestions(data);
        })
        .catch(() => {
          if (!cancelled) setSuggestions([]);
        });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  return suggestions;
}
