from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from neirapp.modules.reviews.domain.entities import RatingSummary, Review


class CreateReviewRequest(BaseModel):
    store_order_id: UUID
    rating: int = Field(ge=1, le=5)
    comment: str | None = Field(default=None, max_length=500)


class ReplyRequest(BaseModel):
    text: str = Field(min_length=2, max_length=500)


class ReviewResponse(BaseModel):
    id: UUID
    store_order_id: UUID
    customer_id: UUID
    rating: int
    comment: str | None
    created_at: datetime
    merchant_reply: str | None
    replied_at: datetime | None

    @classmethod
    def from_domain(cls, review: Review) -> "ReviewResponse":
        return cls(
            id=review.id,
            store_order_id=review.store_order_id,
            customer_id=review.customer_id,
            rating=review.rating,
            comment=review.comment,
            created_at=review.created_at,
            merchant_reply=review.merchant_reply,
            replied_at=review.replied_at,
        )


class StoreRatingResponse(BaseModel):
    store_id: UUID
    average: float
    count: int


class RatingSummaryResponse(BaseModel):
    average: float
    count: int

    @classmethod
    def from_domain(cls, summary: RatingSummary) -> "RatingSummaryResponse":
        return cls(average=summary.average, count=summary.count)
