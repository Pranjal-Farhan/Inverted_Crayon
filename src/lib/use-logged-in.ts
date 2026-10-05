"use client";

import { useEffect, useState } from "react";
import { CUSTOMER_HINT_COOKIE } from "@/lib/customer-hint";

/**
 * Client-only read of the non-sensitive logged-in hint cookie. Defaults to false (matching the
 * server-rendered, visitor-neutral HTML) and updates after mount — the same
 * neutral-default-then-hydrate pattern cart-context.tsx uses for the cart count, so there's no
 * hydration mismatch.
 */
export function useLoggedIn(): boolean {
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    const hasHint = document.cookie.split("; ").some((c) => c.startsWith(`${CUSTOMER_HINT_COOKIE}=`));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoggedIn(hasHint);
  }, []);

  return loggedIn;
}
