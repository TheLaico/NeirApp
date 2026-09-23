from uuid import UUID

from neirapp.modules.incidents.application.ports import (
    DispatchPort,
    OrderingPort,
    UnitOfWorkFactory,
)
from neirapp.modules.incidents.domain.entities import (
    Incident,
    IncidentCategory,
    IncidentStatus,
    ReporterRole,
)
from neirapp.modules.incidents.domain.errors import IncidentNotFound, NotAuthorizedToReport
from neirapp.shared.application.ports import Clock


class ReportIncident:
    """El reportero puede ser el cliente del pedido o el repartidor que lo lleva — se determina
    consultando primero `ordering` y luego `dispatch`, nunca se confía en un rol que mande el
    cliente."""

    def __init__(
        self,
        uow_factory: UnitOfWorkFactory,
        ordering: OrderingPort,
        dispatch: DispatchPort,
        clock: Clock,
    ) -> None:
        self._uow_factory = uow_factory
        self._ordering = ordering
        self._dispatch = dispatch
        self._clock = clock

    async def __call__(
        self,
        order_id: UUID,
        reporter_user_id: UUID,
        *,
        category: IncidentCategory,
        description: str,
    ) -> Incident:
        reporter_role = await self._resolve_role(order_id, reporter_user_id)
        incident = Incident.report(
            order_id=order_id,
            reporter_user_id=reporter_user_id,
            reporter_role=reporter_role,
            category=category,
            description=description,
            now=self._clock.now(),
        )
        async with self._uow_factory() as uow:
            await uow.incidents.add(incident)
            await uow.commit()
        return incident

    async def _resolve_role(self, order_id: UUID, user_id: UUID) -> ReporterRole:
        customer_id = await self._ordering.get_order_customer_id(order_id)
        if customer_id == user_id:
            return ReporterRole.CUSTOMER
        courier_user_id = await self._dispatch.get_delivery_courier_user_id(order_id)
        if courier_user_id == user_id:
            return ReporterRole.COURIER
        raise NotAuthorizedToReport()


class ListMyIncidents:
    def __init__(self, uow_factory: UnitOfWorkFactory) -> None:
        self._uow_factory = uow_factory

    async def __call__(self, reporter_user_id: UUID) -> list[Incident]:
        async with self._uow_factory() as uow:
            return await uow.incidents.list_by_reporter(reporter_user_id)


class ListIncidents:
    """Backoffice: todos los reportes, opcionalmente filtrados por estado."""

    def __init__(self, uow_factory: UnitOfWorkFactory) -> None:
        self._uow_factory = uow_factory

    async def __call__(self, *, status: IncidentStatus | None = None) -> list[Incident]:
        async with self._uow_factory() as uow:
            return await uow.incidents.list_all(status=status)


class ResolveIncident:
    def __init__(self, uow_factory: UnitOfWorkFactory, clock: Clock) -> None:
        self._uow_factory = uow_factory
        self._clock = clock

    async def __call__(
        self, incident_id: UUID, *, status: IncidentStatus, resolution_note: str | None
    ) -> Incident:
        async with self._uow_factory() as uow:
            incident = await uow.incidents.get(incident_id)
            if incident is None:
                raise IncidentNotFound()
            incident.resolve(status=status, resolution_note=resolution_note, now=self._clock.now())
            await uow.incidents.update(incident)
            await uow.commit()
        return incident
