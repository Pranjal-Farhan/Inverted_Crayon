"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function SearchForm({ initialQuery }: { initialQuery: string }) {
  const [q, setQ] = useState(initialQuery);
  const router = useRouter();

  return (
    <form
      className="my-4 flex gap-2.5"
      onSubmit={(e) => {
        e.preventDefault();
        router.push(`/search?q=${encodeURIComponent(q.trim())}`);
      }}
    >
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search products…"
        className="flex-1 border border-line-2 bg-panel px-3.5 py-3 outline-none focus:border-lime"
      />
      <Button size="sm" type="submit" arrow={false}>
        Go
      </Button>
    </form>
  );
}
