from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from neirapp.modules.reviews.domain.entities import RatingSummary, Review
from neirapp.modules.reviews.domain.errors import ReviewAlreadyExists
from neirapp.modules.reviews.infrastructure.models import ReviewModel


def _to_review(model: ReviewModel) -> Review:
    return Review(
        id=model.id,
        store_order_id=model.store_order_id,
        order_id=model.order_id,
        store_id=model.store_id,
        customer_id=model.customer_id,
        rating=model.rating,
        comment=model.comment,
        created_at=model.created_at,
        merchant_reply=model.merchant_reply,
        replied_at=model.replied_at,
    )


class SqlAlchemyReviewRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, review: Review) -> None:
        self._session.add(
            ReviewModel(
                id=review.id,
                store_order_id=review.store_order_id,
                order_id=review.order_id,
                store_id=review.store_id,
                customer_id=review.customer_id,
                rating=review.rating,
                comment=review.comment,
                created_at=review.created_at,
            )
        )
        try:
            await self._session.flush()
        except IntegrityError as exc:
            raise ReviewAlreadyExists() from exc

    async def get(self, review_id: UUID) -> Review | None:
        model = await self._session.get(ReviewModel, review_id)
        return _to_review(model) if model else None

    async def update(self, review: Review) -> None:
        model = await self._session.get(ReviewModel, review.id)
        if model is None:
            raise LookupError(f"Reseña {review.id} no existe")
        model.merchant_reply = review.merchant_reply
        model.replied_at = review.replied_at
        await self._session.flush()

    async def list_by_store(self, store_id: UUID) -> list[Review]:
        result = await self._session.execute(
            select(ReviewModel)
            .where(ReviewModel.store_id == store_id)
            .order_by(ReviewModel.created_at.desc())
        )
        return [_to_review(m) for m in result.scalars()]

    async def summaries(self) -> dict[UUID, RatingSummary]:
        result = await self._session.execute(
            select(
                ReviewModel.store_id, func.avg(ReviewModel.rating), func.count(ReviewModel.id)
            ).group_by(ReviewModel.store_id)
        )
        return {
            store_id: RatingSummary(average=round(float(average), 1), count=count)
            for store_id, average, count in result.all()
        }
