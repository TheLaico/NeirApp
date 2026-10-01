from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from neirapp.modules.incidents.domain.entities import (
    Incident,
    IncidentCategory,
    IncidentStatus,
    ReporterRole,
)
from neirapp.modules.incidents.infrastructure.models import IncidentModel


def _to_incident(model: IncidentModel) -> Incident:
    return Incident(
        id=model.id,
        order_id=model.order_id,
        reporter_user_id=model.reporter_user_id,
        reporter_role=ReporterRole(model.reporter_role),
        category=IncidentCategory(model.category),
        description=model.description,
        status=IncidentStatus(model.status),
        resolution_note=model.resolution_note,
        created_at=model.created_at,
        resolved_at=model.resolved_at,
    )


class SqlAlchemyIncidentRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, incident: Incident) -> None:
        self._session.add(
            IncidentModel(
                id=incident.id,
                order_id=incident.order_id,
                reporter_user_id=incident.reporter_user_id,
                reporter_role=incident.reporter_role.value,
                category=incident.category.value,
                description=incident.description,
                status=incident.status.value,
                resolution_note=incident.resolution_note,
                created_at=incident.created_at,
                resolved_at=incident.resolved_at,
            )
        )
        await self._session.flush()

    async def get(self, incident_id: UUID) -> Incident | None:
        model = await self._session.get(IncidentModel, incident_id)
        return _to_incident(model) if model else None

    async def list_by_reporter(self, reporter_user_id: UUID) -> list[Incident]:
        result = await self._session.execute(
            select(IncidentModel)
            .where(IncidentModel.reporter_user_id == reporter_user_id)
            .order_by(IncidentModel.created_at.desc())
        )
        return [_to_incident(m) for m in result.scalars()]

    async def list_all(self, *, status: IncidentStatus | None = None) -> list[Incident]:
        stmt = select(IncidentModel).order_by(IncidentModel.created_at.desc())
        if status is not None:
            stmt = stmt.where(IncidentModel.status == status.value)
        result = await self._session.execute(stmt)
        return [_to_incident(m) for m in result.scalars()]

    async def update(self, incident: Incident) -> None:
        model = await self._session.get(IncidentModel, incident.id)
        if model is None:
            raise LookupError(f"Reporte {incident.id} no existe")
        model.status = incident.status.value
        model.resolution_note = incident.resolution_note
        model.resolved_at = incident.resolved_at
        await self._session.flush()
