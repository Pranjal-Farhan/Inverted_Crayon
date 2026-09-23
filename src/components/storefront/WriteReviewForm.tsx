"use client";

import { useState, useTransition } from "react";
import { submitReview } from "@/actions/customer-reviews";

export function WriteReviewForm({ productId, orderNumber, productTitle }: { productId: string; orderNumber: string; productTitle: string }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; error?: string } | null>(null);

  if (result?.ok) {
    return <p className="text-[13px] text-lime">Thanks — your review is queued for approval.</p>;
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="font-label text-[12px] tracking-[1px] text-cyan hover:underline">
        Write a review
      </button>
    );
  }

  return (
    <div className="mt-2 border border-line bg-panel-2 p-3.5">
      <p className="mb-2 text-[13px] text-muted">Reviewing {productTitle}</p>
      <div className="mb-2 flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onClick={() => setRating(n)} aria-label={`${n} stars`} className={n <= rating ? "text-yellow" : "text-muted-2"}>
            ★
          </button>
        ))}
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        placeholder="How did it fit? Hold up to washes?"
        className="w-full border border-line-2 bg-ink px-2.5 py-1.5 text-sm outline-none focus:border-lime"
      />
      {result && !result.ok && <p className="mt-1 text-[12px] text-error">{result.error}</p>}
      <div className="mt-2 flex gap-2">
        <button
          disabled={pending || body.trim().length < 5}
          onClick={() =>
            startTransition(async () => {
              const res = await submitReview({ productId, orderNumber, rating, body });
              setResult(res.ok ? { ok: true } : { ok: false, error: res.error });
            })
          }
          className="btn-primary bg-lime px-3.5 py-1.5 font-impact text-sm text-ink disabled:opacity-50"
        >
          Submit
        </button>
        <button onClick={() => setOpen(false)} className="border border-line-2 px-3.5 py-1.5 text-sm">
          Cancel
        </button>
      </div>
    </div>
  );
}
