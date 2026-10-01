from collections.abc import Callable
from types import TracebackType
from typing import Protocol, Self
from uuid import UUID

from neirapp.modules.wallet.domain.entities import LedgerEntry


class LedgerRepository(Protocol):
    async def add(self, entry: LedgerEntry) -> None: ...

    async def list_by_courier(self, courier_id: UUID) -> list[LedgerEntry]: ...


class UnitOfWork(Protocol):
    @property
    def ledger(self) -> LedgerRepository: ...

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
