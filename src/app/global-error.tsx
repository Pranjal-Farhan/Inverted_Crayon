"use client";

import "./globals.css";
import { useEffect } from "react";
import { RetryPanel } from "@/components/system/RetryPanel";

/** Replaces the root layout when the layout itself fails, so it brings its own <html> and <body>. */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-ink text-paper">
        <RetryPanel retry={retry} digest={error.digest} variant="page" />
      </body>
    </html>
  );
}
