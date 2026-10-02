from types import TracebackType
from typing import Any, Self

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from neirapp.modules.stores.infrastructure.repositories import (
    SqlAlchemyProductRepository,
    SqlAlchemyPromotionRepository,
    SqlAlchemyStoreRepository,
)


class SqlAlchemyUnitOfWork:
    def __init__(self, session_factory: async_sessionmaker[Any]) -> None:
        self._session_factory = session_factory
        self._session: AsyncSession | None = None

    async def __aenter__(self) -> Self:
        self._session = self._session_factory()
        self.stores = SqlAlchemyStoreRepository(self._session)
        self.products = SqlAlchemyProductRepository(self._session)
        self.promotions = SqlAlchemyPromotionRepository(self._session)
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        tb: TracebackType | None,
    ) -> None:
        assert self._session is not None
        try:
            if exc_type is not None:
                await self._session.rollback()
        finally:
            await self._session.close()

    async def commit(self) -> None:
        assert self._session is not None
        await self._session.commit()

    async def rollback(self) -> None:
        assert self._session is not None
        await self._session.rollback()
