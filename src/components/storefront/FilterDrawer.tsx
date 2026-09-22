"use client";

import { useState } from "react";

export function FilterDrawer({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="desktop:hidden mb-4 border border-line-2 px-4 py-2 font-label text-sm tracking-[1px]"
      >
        FILTER ▾
      </button>
      <aside className="filt desktop:block hidden">{children}</aside>

      <div
        className={`fixed inset-0 z-[200] bg-black/60 desktop:hidden transition-opacity ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setOpen(false)}
      />
      <div
        className={`fixed inset-x-0 bottom-0 z-[205] max-h-[80vh] overflow-y-auto bg-panel p-5 desktop:hidden transition-transform ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="mb-3 flex items-center justify-between">
          <span className="font-impact text-lg uppercase">Filter</span>
          <button onClick={() => setOpen(false)} className="text-2xl text-muted">
            ×
          </button>
        </div>
        {children}
      </div>
    </>
  );
}
