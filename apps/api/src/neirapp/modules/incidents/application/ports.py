from collections.abc import Callable
from types import TracebackType
from typing import Protocol, Self
from uuid import UUID

from neirapp.modules.incidents.domain.entities import Incident, IncidentStatus


class OrderingPort(Protocol):
    """Capa anticorrupción hacia `ordering` (mismo puerto, definido de nuevo aquí: cada módulo
    consumidor declara solo lo que necesita — ver `dispatch.application.ports.OrderingPort`)."""

    async def get_order_customer_id(self, order_id: UUID) -> UUID | None: ...


class DispatchPort(Protocol):
    """Capa anticorrupción hacia `dispatch`."""

    async def get_delivery_courier_user_id(self, order_id: UUID) -> UUID | None: ...


class IncidentRepository(Protocol):
    async def add(self, incident: Incident) -> None: ...

    async def get(self, incident_id: UUID) -> Incident | None: ...

    async def list_by_reporter(self, reporter_user_id: UUID) -> list[Incident]: ...

    async def list_all(self, *, status: IncidentStatus | None = None) -> list[Incident]: ...

    async def update(self, incident: Incident) -> None: ...


class UnitOfWork(Protocol):
    @property
    def incidents(self) -> IncidentRepository: ...

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
