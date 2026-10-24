"use client";

import { useEffect } from "react";
import { RetryPanel } from "@/components/system/RetryPanel";

/** Last-resort page for anything that fails outside a section that has its own error.tsx (a layout, the admin shell…). */
export default function RootError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return <RetryPanel retry={retry} digest={error.digest} variant="page" />;
}
