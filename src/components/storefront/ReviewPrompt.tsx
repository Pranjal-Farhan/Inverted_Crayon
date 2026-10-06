"use client";

import Link from "next/link";
import { useLoggedIn } from "@/lib/use-logged-in";

/** Split out of the product page so the page itself stays session-free and can be static/ISR. */
export function ReviewPrompt() {
  const loggedIn = useLoggedIn();
  if (!loggedIn) return null;
  return (
    <p className="mt-3 text-[13px] text-muted">
      Bought this? <Link href="/account/orders" className="text-cyan" prefetch={false}>Write a review</Link> from your order history.
    </p>
  );
}
