"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getWishlistStatus, toggleWishlist } from "@/actions/customer-profile";
import { useLoggedIn } from "@/lib/use-logged-in";

export function WishlistButton({ productId }: { productId: string }) {
  const loggedIn = useLoggedIn();
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  // The product page itself is static/ISR (no session read during render), so whether this
  // specific product is already saved is fetched here, client-side, only for visitors the hint
  // cookie says are logged in — never blocking or affecting the page's static shell.
  useEffect(() => {
    if (!loggedIn) return;
    let cancelled = false;
    getWishlistStatus(productId).then((res) => {
      if (!cancelled) setSaved(res.inWishlist);
    });
    return () => {
      cancelled = true;
    };
  }, [loggedIn, productId]);

  return (
    <button
      disabled={pending}
      onClick={() => {
        if (!loggedIn) {
          router.push("/account/login");
          return;
        }
        startTransition(async () => {
          const res = await toggleWishlist(productId);
          setSaved(res.inWishlist);
        });
      }}
      className="inline-flex items-center gap-1.5 font-label text-sm tracking-[1px] text-muted hover:text-pink disabled:opacity-50"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill={saved ? "#ff2d84" : "none"} stroke={saved ? "#ff2d84" : "currentColor"} strokeWidth="2">
        <path d="M12 21s-7.5-4.6-10-9.1C.5 8.6 2.2 5 5.8 5c2 0 3.4 1 4.2 2.3C10.8 6 12.2 5 14.2 5c3.6 0 5.3 3.6 3.8 6.9C19.5 16.4 12 21 12 21z" />
      </svg>
      {saved ? "Saved" : "Save"}
    </button>
  );
}
