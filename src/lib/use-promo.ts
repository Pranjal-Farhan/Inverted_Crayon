"use client";

import { useEffect, useState } from "react";
import type { CouponType } from "@/lib/coupon-format";

export type PromoResult =
  | {
      ok: true;
      code: string;
      type: CouponType;
      value: number;
      maxDiscountAmount: number | null;
      scope: "GLOBAL" | "PRODUCT";
      /** Taka off the items (0 for a free-delivery coupon). */
      itemDiscount: number;
      /** The delivery charge is waived. */
      freeShipping: boolean;
      /** A percentage coupon hit its maximum-discount ceiling. */
      capApplied: boolean;
    }
  | { ok: false; kind: "INVALID" | "NOT_FOR_PRODUCT" | "UNAVAILABLE"; reason: string }
  | null;

export function usePromoValidation(code: string | null, lines: { variantId: string; qty: number }[]) {
  const [result, setResult] = useState<PromoResult>(null);
  const [loading, setLoading] = useState(false);
  // Re-check whenever what's in the bag changes, not just the code: a product-locked coupon can
  // stop applying (or start to) the moment a line is added or removed.
  const linesKey = lines.map((l) => `${l.variantId}:${l.qty}`).join(",");

  // Synchronizes with the server's coupon validation (an external system) whenever the code or
  // the bag changes — the canonical fetch-on-dependency-change effect pattern.
  useEffect(() => {
    if (!code || !linesKey) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResult(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch("/api/discount", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        lines: linesKey.split(",").map((pair) => {
          const [variantId, qty] = pair.split(":");
          return { variantId, qty: Number(qty) };
        }),
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setResult(data);
      })
      .catch(() => {
        if (!cancelled) setResult({ ok: false, kind: "UNAVAILABLE", reason: "Couldn't check that coupon — try again." });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [code, linesKey]);

  return { result, loading };
}
