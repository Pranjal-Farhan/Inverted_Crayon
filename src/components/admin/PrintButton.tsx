"use client";

import Link from "next/link";

export function ReceiptToolbar({ backHref }: { backHref: string }) {
  return (
    <div className="print:hidden mx-auto mb-4 flex max-w-[680px] items-center justify-between">
      <Link href={backHref} className="text-cyan text-sm hover:underline">
        ← Back to order
      </Link>
      <button
        onClick={() => window.print()}
        className="border border-ink/20 bg-ink px-4 py-2 text-sm text-paper hover:bg-ink/80"
      >
        Print / Save as PDF
      </button>
    </div>
  );
}
