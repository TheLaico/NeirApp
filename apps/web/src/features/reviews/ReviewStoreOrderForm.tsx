import { useState } from "react";
import { ApiError, errorMessage } from "../../lib/errors";
import { ErrorAlert } from "../../shared/ui/Alert";
import { Button } from "../../shared/ui/Button";
import { useCreateReview } from "./api";
import { StarRating } from "./StarRating";

export function ReviewStoreOrderForm({ storeOrderId }: { storeOrderId: string }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);
  const createReview = useCreateReview();

  if (createReview.isSuccess || alreadyReviewed) {
    return (
      <div className="rounded-card border border-line bg-white p-4 shadow-soft">
        <p className="text-sm font-medium text-brand">¡Gracias por calificar esta tienda!</p>
      </div>
    );
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (rating === 0) return;
        createReview.mutate(
          { store_order_id: storeOrderId, rating, comment: comment.trim() || null },
          {
            onError: (error) => {
              if (error instanceof ApiError && error.code === "review_already_exists") {
                setAlreadyReviewed(true);
              }
            },
          },
        );
      }}
      className="space-y-3 rounded-card border border-line bg-white p-4 shadow-soft"
    >
      <p className="text-sm font-medium text-ink">Califica esta tienda</p>
      {createReview.isError &&
        !(createReview.error instanceof ApiError && createReview.error.code === "review_already_exists") && (
          <ErrorAlert message={errorMessage(createReview.error)} />
        )}
      <StarRating value={rating} onChange={setRating} size={24} />
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Cuéntanos cómo te fue (opcional)"
        rows={2}
        maxLength={500}
        className="w-full rounded-control border border-line bg-white px-3.5 py-2.5 text-[15px] text-ink focus:border-brand"
      />
      <Button type="submit" disabled={rating === 0} loading={createReview.isPending}>
        Enviar calificación
      </Button>
    </form>
  );
}
