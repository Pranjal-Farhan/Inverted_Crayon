"use client";

import { useEffect, useState } from "react";

export type PromoResult =
  | { ok: true; amount: number; type: "PERCENT" | "FIXED" | "FREE_SHIPPING"; code: string }
  | { ok: false; reason: string }
  | null;

export function usePromoValidation(code: string | null, subtotal: number) {
  const [result, setResult] = useState<PromoResult>(null);
  const [loading, setLoading] = useState(false);

  // Synchronizes with the server's discount validation (an external
  // system) whenever the code or subtotal changes — the canonical
  // fetch-on-dependency-change effect pattern.
  useEffect(() => {
    if (!code) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResult(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch("/api/discount", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, subtotal }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setResult(data);
      })
      .catch(() => {
        if (!cancelled) setResult({ ok: false, reason: "Couldn't check that code — try again." });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [code, subtotal]);

  return { result, loading };
}
