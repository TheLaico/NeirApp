from uuid import UUID

from fastapi import APIRouter

from neirapp.modules.identity.presentation.dependencies import CurrentUser
from neirapp.modules.reviews.presentation.dependencies import ReviewsDep
from neirapp.modules.reviews.presentation.schemas import (
    CreateReviewRequest,
    RatingSummaryResponse,
    ReplyRequest,
    ReviewResponse,
    StoreRatingResponse,
)

router = APIRouter(prefix="/reviews", tags=["reviews"])


@router.post("", response_model=ReviewResponse, status_code=201)
async def create_review(
    body: CreateReviewRequest, user: CurrentUser, reviews: ReviewsDep
) -> ReviewResponse:
    review = await reviews.create_review(
        body.store_order_id, user.id, rating=body.rating, comment=body.comment
    )
    return ReviewResponse.from_domain(review)


@router.post("/{review_id}/reply", response_model=ReviewResponse)
async def reply_to_review(
    review_id: UUID, body: ReplyRequest, user: CurrentUser, reviews: ReviewsDep
) -> ReviewResponse:
    """El dueño de la tienda responde una reseña (o edita su respuesta)."""
    review = await reviews.reply_to_review(review_id, user.id, body.text)
    return ReviewResponse.from_domain(review)


@router.get("/summaries", response_model=list[StoreRatingResponse])
async def list_rating_summaries(reviews: ReviewsDep) -> list[StoreRatingResponse]:
    """Calificación promedio de cada tienda con reseñas (público: la lista de tiendas la usa)."""
    summaries = await reviews.list_rating_summaries()
    return [
        StoreRatingResponse(store_id=sid, average=s.average, count=s.count)
        for sid, s in summaries.items()
    ]


@router.get("/stores/{store_id}", response_model=list[ReviewResponse])
async def list_store_reviews(store_id: UUID, reviews: ReviewsDep) -> list[ReviewResponse]:
    store_reviews = await reviews.list_store_reviews(store_id)
    return [ReviewResponse.from_domain(r) for r in store_reviews]


@router.get("/stores/{store_id}/summary", response_model=RatingSummaryResponse)
async def get_store_rating_summary(store_id: UUID, reviews: ReviewsDep) -> RatingSummaryResponse:
    summary = await reviews.get_store_rating_summary(store_id)
    return RatingSummaryResponse.from_domain(summary)
