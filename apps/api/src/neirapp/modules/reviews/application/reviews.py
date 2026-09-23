from uuid import UUID

from neirapp.modules.reviews.application.ports import OrderingPort, UnitOfWorkFactory
from neirapp.modules.reviews.domain.entities import RatingSummary, Review, compute_rating_summary
from neirapp.modules.reviews.domain.errors import (
    NotStoreOrderCustomer,
    ReviewableStoreOrderNotFound,
    StoreOrderNotCompleted,
)
from neirapp.shared.application.ports import Clock

_COMPLETED_STATUS = "handed_over"


class CreateReview:
    """Solo se puede calificar un `StoreOrder` que la tienda ya entregó al repartidor
    (`handed_over`) — no valida que el cliente ya lo tenga en mano (eso vive en `dispatch`, que
    `reviews` no conoce). Simplificación documentada: suficiente para el MVP, ver
    docs/ARCHITECTURE.md."""

    def __init__(
        self, uow_factory: UnitOfWorkFactory, ordering: OrderingPort, clock: Clock
    ) -> None:
        self._uow_factory = uow_factory
        self._ordering = ordering
        self._clock = clock

    async def __call__(
        self, store_order_id: UUID, customer_id: UUID, *, rating: int, comment: str | None
    ) -> Review:
        snapshot = await self._ordering.get_store_order(store_order_id)
        if snapshot is None:
            raise ReviewableStoreOrderNotFound()
        if snapshot.customer_id != customer_id:
            raise NotStoreOrderCustomer()
        if snapshot.status != _COMPLETED_STATUS:
            raise StoreOrderNotCompleted()

        review = Review.create(
            store_order_id=snapshot.store_order_id,
            order_id=snapshot.order_id,
            store_id=snapshot.store_id,
            customer_id=customer_id,
            rating=rating,
            comment=comment,
            now=self._clock.now(),
        )
        async with self._uow_factory() as uow:
            await uow.reviews.add(review)
            await uow.commit()
        return review


class ListStoreReviews:
    def __init__(self, uow_factory: UnitOfWorkFactory) -> None:
        self._uow_factory = uow_factory

    async def __call__(self, store_id: UUID) -> list[Review]:
        async with self._uow_factory() as uow:
            return await uow.reviews.list_by_store(store_id)


class GetStoreRatingSummary:
    def __init__(self, uow_factory: UnitOfWorkFactory) -> None:
        self._uow_factory = uow_factory

    async def __call__(self, store_id: UUID) -> RatingSummary:
        async with self._uow_factory() as uow:
            reviews = await uow.reviews.list_by_store(store_id)
        return compute_rating_summary(reviews)
