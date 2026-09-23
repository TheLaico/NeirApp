from dataclasses import dataclass
from datetime import datetime
from uuid import UUID, uuid4

from neirapp.modules.reviews.domain.errors import InvalidRating

MAX_COMMENT_LENGTH = 500


@dataclass(frozen=True)
class Review:
    """Calificación de un cliente a una tienda, atada a un `StoreOrder` puntual (nunca a la
    tienda "en general"): así no se puede calificar sin haber comprado, y a lo sumo una vez por
    pedido — ver la restricción única en `infrastructure/models.py`."""

    id: UUID
    store_order_id: UUID
    order_id: UUID
    store_id: UUID
    customer_id: UUID
    rating: int
    comment: str | None
    created_at: datetime

    @classmethod
    def create(
        cls,
        *,
        store_order_id: UUID,
        order_id: UUID,
        store_id: UUID,
        customer_id: UUID,
        rating: int,
        comment: str | None,
        now: datetime,
    ) -> "Review":
        if not 1 <= rating <= 5:
            raise InvalidRating()
        normalized_comment = comment.strip()[:MAX_COMMENT_LENGTH] if comment else None
        return cls(
            id=uuid4(),
            store_order_id=store_order_id,
            order_id=order_id,
            store_id=store_id,
            customer_id=customer_id,
            rating=rating,
            comment=normalized_comment or None,
            created_at=now,
        )


@dataclass(frozen=True)
class RatingSummary:
    average: float
    count: int


def compute_rating_summary(reviews: list[Review]) -> RatingSummary:
    if not reviews:
        return RatingSummary(average=0.0, count=0)
    average = sum(r.rating for r in reviews) / len(reviews)
    return RatingSummary(average=round(average, 1), count=len(reviews))
