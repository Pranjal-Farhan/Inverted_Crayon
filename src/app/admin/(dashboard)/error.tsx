"use client";

import { useEffect } from "react";
import { RetryPanel } from "@/components/system/RetryPanel";

/** An admin page failed to build — keeps the sidebar and top bar, and retries in the page area. */
export default function AdminError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return <RetryPanel retry={retry} digest={error.digest} variant="admin" />;
}
