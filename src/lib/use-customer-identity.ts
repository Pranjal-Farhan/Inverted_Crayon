"use client";

import { useEffect, useState } from "react";
import { useLoggedIn } from "@/lib/use-logged-in";

export type CustomerIdentity = { name: string | null; email: string; avatarUrl: string | null };

/**
 * Name/avatar for the logged-in customer, fetched client-side after mount (GET /api/account/me)
 * only when the non-sensitive hint cookie says someone's logged in — see useLoggedIn's doc comment
 * for why this stays a post-mount fetch instead of a server-rendered prop: personalizing the
 * storefront shell itself would break its ISR caching. Returns null while logged out or loading.
 */
export function useCustomerIdentity(): CustomerIdentity | null {
  const loggedIn = useLoggedIn();
  const [identity, setIdentity] = useState<CustomerIdentity | null>(null);

  useEffect(() => {
    if (!loggedIn) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting to the logged-out default when the hint cookie disappears (e.g. after logout), not derived from props
      setIdentity(null);
      return;
    }
    let cancelled = false;
    fetch("/api/account/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) setIdentity(data);
      })
      .catch(() => {
        if (!cancelled) setIdentity(null);
      });
    return () => {
      cancelled = true;
    };
  }, [loggedIn]);

  return identity;
}
