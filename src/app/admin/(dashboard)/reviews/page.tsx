import { db } from "@/lib/db";
import { Panel } from "@/components/admin/Panel";
import { ReviewRow } from "@/components/admin/ReviewRow";

export default async function AdminReviewsPage() {
  const reviews = await db.review.findMany({
    include: { product: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <Panel title="Reviews">
      {reviews.length === 0 ? (
        <p className="text-sm text-muted">No reviews yet.</p>
      ) : (
        reviews.map((r) => (
          <ReviewRow
            key={r.id}
            id={r.id}
            productTitle={r.product.title}
            authorName={r.authorName}
            rating={r.rating}
            body={r.body}
            status={r.status}
            reply={r.reply}
          />
        ))
      )}
    </Panel>
  );
}
