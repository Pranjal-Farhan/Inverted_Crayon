"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleWishlist } from "@/actions/customer-profile";

export function WishlistButton({
  productId,
  initialSaved,
  loggedIn,
}: {
  productId: string;
  initialSaved: boolean;
  loggedIn: boolean;
}) {
  const [saved, setSaved] = useState(initialSaved);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

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
