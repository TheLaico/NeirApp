from collections.abc import Callable
from types import TracebackType
from typing import Protocol, Self
from uuid import UUID

from neirapp.modules.reviews.application.dto import ReviewableStoreOrderSnapshot
from neirapp.modules.reviews.domain.entities import RatingSummary, Review


class OrderingPort(Protocol):
    """Capa anticorrupción hacia `ordering` (mismo patrón que el `StoresPort` de `dispatch`)."""

    async def get_store_order(
        self, store_order_id: UUID
    ) -> ReviewableStoreOrderSnapshot | None: ...


class ReviewRepository(Protocol):
    async def add(self, review: Review) -> None: ...

    async def get(self, review_id: UUID) -> Review | None: ...

    async def update(self, review: Review) -> None: ...

    async def list_by_store(self, store_id: UUID) -> list[Review]: ...

    async def summaries(self) -> dict[UUID, RatingSummary]: ...


class UnitOfWork(Protocol):
    @property
    def reviews(self) -> ReviewRepository: ...

    async def __aenter__(self) -> Self: ...

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        tb: TracebackType | None,
    ) -> None: ...

    async def commit(self) -> None: ...

    async def rollback(self) -> None: ...


UnitOfWorkFactory = Callable[[], UnitOfWork]
