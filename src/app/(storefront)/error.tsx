"use client";

import { useEffect } from "react";
import { RetryPanel } from "@/components/system/RetryPanel";

/** A storefront page failed to build — keeps the header and footer, and retries in the page area. */
export default function StorefrontError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return <RetryPanel retry={retry} digest={error.digest} variant="inline" />;
}
