import { useStoreRatingSummary, useStoreReviews } from "./api";
import { StarRating } from "./StarRating";

export function StoreReviewsSection({ storeId }: { storeId: string }) {
  const summary = useStoreRatingSummary(storeId);
  const reviews = useStoreReviews(storeId);

  return (
    <section className="mt-6">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-lg">Calificaciones</h2>
        {!!summary.data?.count && (
          <span className="flex items-center gap-1.5 text-sm text-muted">
            <StarRating value={Math.round(summary.data.average)} size={14} />
            {summary.data.average.toFixed(1)} ({summary.data.count})
          </span>
        )}
      </div>

      {reviews.data?.length === 0 && (
        <p className="text-muted">Esta tienda todavía no tiene calificaciones.</p>
      )}

      <ul className="space-y-3">
        {reviews.data?.map((review) => (
          <li
            key={review.id}
            className="rounded-card border border-line bg-white p-4 shadow-soft"
          >
            <div className="mb-1 flex items-center justify-between">
              <StarRating value={review.rating} size={14} />
              <span className="text-xs text-muted">
                {new Date(review.created_at).toLocaleDateString("es-CO", { dateStyle: "medium" })}
              </span>
            </div>
            {review.comment && <p className="text-sm text-ink">{review.comment}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
