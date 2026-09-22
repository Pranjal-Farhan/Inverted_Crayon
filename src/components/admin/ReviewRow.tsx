"use client";

import { useState, useTransition } from "react";
import { setReviewStatus, replyToReview } from "@/actions/admin-reviews";
import { StatusBadge } from "@/components/admin/StatusBadge";

export function ReviewRow({
  id,
  productTitle,
  authorName,
  rating,
  body,
  status,
  reply,
}: {
  id: string;
  productTitle: string;
  authorName: string;
  rating: number;
  body: string;
  status: string;
  reply: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [replyText, setReplyText] = useState(reply ?? "");
  const [showReply, setShowReply] = useState(false);

  return (
    <div className="border-b border-line py-3.5">
      <div className="flex items-center justify-between">
        <div>
          <span className="font-medium">{productTitle}</span>{" "}
          <span className="text-yellow">{"★".repeat(rating)}</span>{" "}
          <span className="text-[13px] text-muted">— {authorName}</span>
        </div>
        <StatusBadge status={status === "APPROVED" ? "Active" : status === "PENDING" ? "Scheduled" : "Draft"} />
      </div>
      <p className="mt-1 text-sm text-[#ddd]">{body}</p>
      {reply && <p className="mt-1 text-sm text-cyan">Reply: {reply}</p>}
      <div className="mt-2 flex flex-wrap gap-2 text-[13px]">
        {status !== "APPROVED" && (
          <button disabled={pending} onClick={() => startTransition(() => setReviewStatus(id, "APPROVED"))} className="text-lime hover:underline">
            Approve
          </button>
        )}
        {status !== "REJECTED" && (
          <button disabled={pending} onClick={() => startTransition(() => setReviewStatus(id, "REJECTED"))} className="text-error hover:underline">
            Reject
          </button>
        )}
        <button onClick={() => setShowReply((s) => !s)} className="text-muted hover:text-paper">
          Reply
        </button>
      </div>
      {showReply && (
        <div className="mt-2 flex gap-2">
          <input value={replyText} onChange={(e) => setReplyText(e.target.value)} className="flex-1 border border-line-2 bg-ink px-2.5 py-1.5 text-sm" />
          <button
            disabled={pending}
            onClick={() => startTransition(async () => { await replyToReview(id, replyText); setShowReply(false); })}
            className="border border-line-2 px-3 py-1.5 text-sm hover:border-lime"
          >
            Send
          </button>
        </div>
      )}
    </div>
  );
}
