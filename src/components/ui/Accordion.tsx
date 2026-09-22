"use client";

import { useState } from "react";

export function Accordion({ items }: { items: { title: string; body: string }[] }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div>
      {items.map((item, i) => (
        <div key={item.title} className="border-b border-line py-3.5">
          <button
            className="flex w-full items-center justify-between font-label text-base tracking-[1.4px]"
            onClick={() => setOpen((o) => (o === i ? null : i))}
          >
            {item.title.toUpperCase()} <span>{open === i ? "−" : "+"}</span>
          </button>
          {open === i && <p className="mt-1.5 text-[13px] text-muted">{item.body}</p>}
        </div>
      ))}
    </div>
  );
}
