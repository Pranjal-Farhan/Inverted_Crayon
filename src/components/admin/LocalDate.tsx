"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/**
 * A timestamp shown in the *viewer's* timezone. The server renders in UTC while an admin in
 * Dhaka is UTC+6, so formatting a stored instant directly in a client component can disagree
 * between the server pass and the browser (a hydration mismatch, and a wrong-looking date near
 * midnight). useSyncExternalStore's server snapshot makes hydration render the stable UTC text
 * first, then re-render in local time — no mismatch, and no setState-in-effect.
 */
export function LocalDate({ iso, withTime = false }: { iso: string; withTime?: boolean }) {
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  const options: Intl.DateTimeFormatOptions = withTime
    ? { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }
    : { day: "2-digit", month: "short", year: "numeric" };
  return <>{new Date(iso).toLocaleString("en-GB", { ...options, timeZone: mounted ? undefined : "UTC" })}</>;
}
