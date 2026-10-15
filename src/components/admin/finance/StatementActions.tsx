"use client";

import { btnGhost } from "./ui";

export function StatementActions({ exportHref }: { exportHref: string }) {
  return (
    <div className="flex gap-2 print:hidden">
      <button type="button" onClick={() => window.print()} className={btnGhost}>
        Print / save as PDF
      </button>
      <a href={exportHref} className={btnGhost} download>
        Download CSV
      </a>
    </div>
  );
}
