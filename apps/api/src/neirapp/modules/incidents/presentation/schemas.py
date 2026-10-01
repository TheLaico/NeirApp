from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from neirapp.modules.incidents.domain.entities import (
    Incident,
    IncidentCategory,
    IncidentStatus,
    ReporterRole,
)


class ReportIncidentRequest(BaseModel):
    order_id: UUID
    category: IncidentCategory
    description: str = Field(min_length=1, max_length=1000)


class ResolveIncidentRequest(BaseModel):
    status: IncidentStatus
    resolution_note: str | None = Field(default=None, max_length=1000)


class IncidentResponse(BaseModel):
    id: UUID
    order_id: UUID
    reporter_user_id: UUID
    reporter_role: ReporterRole
    category: IncidentCategory
    description: str
    status: IncidentStatus
    resolution_note: str | None
    created_at: datetime
    resolved_at: datetime | None

    @classmethod
    def from_domain(cls, incident: Incident) -> "IncidentResponse":
        return cls(
            id=incident.id,
            order_id=incident.order_id,
            reporter_user_id=incident.reporter_user_id,
            reporter_role=incident.reporter_role,
            category=incident.category,
            description=incident.description,
            status=incident.status,
            resolution_note=incident.resolution_note,
            created_at=incident.created_at,
            resolved_at=incident.resolved_at,
        )
