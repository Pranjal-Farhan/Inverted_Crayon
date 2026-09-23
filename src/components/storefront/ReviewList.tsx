type ReviewItem = {
  id: string;
  authorName: string;
  rating: number;
  body: string;
  reply: string | null;
  createdAt: Date;
};

export function ReviewList({ reviews }: { reviews: ReviewItem[] }) {
  if (reviews.length === 0) {
    return <p className="text-sm text-muted">No reviews yet — be the first.</p>;
  }

  return (
    <div>
      {reviews.map((r) => (
        <div key={r.id} className="border-b border-line py-3.5">
          <div className="flex items-center gap-2">
            <span className="text-yellow">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
            <span className="text-sm font-medium">{r.authorName}</span>
            <span className="text-[12px] text-muted">
              {r.createdAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
            </span>
          </div>
          <p className="mt-1.5 text-sm text-[#ddd]">{r.body}</p>
          {r.reply && (
            <p className="mt-1.5 border-l-2 border-cyan pl-2.5 text-[13px] text-cyan">
              <span className="font-label tracking-[1px]">STORE REPLY </span>
              {r.reply}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
