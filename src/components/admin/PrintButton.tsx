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

/** The bar above a printable statement: back link, and the button that opens the browser's print / Save as PDF dialog. Hidden when printing. */
export function StatementToolbar({ backHref }: { backHref: string }) {
  return (
    <div className="print:hidden mx-auto mb-4 flex max-w-[820px] items-center justify-between">
      <Link href={backHref} className="text-cyan text-sm hover:underline">
        ← Back to the statement
      </Link>
      <button onClick={() => window.print()} className="border border-ink/20 bg-ink px-4 py-2 text-sm text-paper hover:bg-ink/80">
        Print / Save as PDF
      </button>
    </div>
  );
}
