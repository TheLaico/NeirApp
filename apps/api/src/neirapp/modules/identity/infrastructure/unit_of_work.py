from types import TracebackType
from typing import Any, Self

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from neirapp.modules.identity.infrastructure.repositories import (
    SqlAlchemyRefreshTokenRepository,
    SqlAlchemyTermsRepository,
    SqlAlchemyUserRepository,
)


class SqlAlchemyUnitOfWork:
    users: SqlAlchemyUserRepository
    terms: SqlAlchemyTermsRepository
    refresh_tokens: SqlAlchemyRefreshTokenRepository

    def __init__(self, session_factory: async_sessionmaker[Any]) -> None:
        self._session_factory = session_factory
        self._session: AsyncSession | None = None

    async def __aenter__(self) -> Self:
        self._session = self._session_factory()
        self.users = SqlAlchemyUserRepository(self._session)
        self.terms = SqlAlchemyTermsRepository(self._session)
        self.refresh_tokens = SqlAlchemyRefreshTokenRepository(self._session)
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
