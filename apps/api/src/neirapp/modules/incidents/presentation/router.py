from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from neirapp.modules.identity.domain.entities import Role, User
from neirapp.modules.identity.presentation.dependencies import CurrentUser, require_roles
from neirapp.modules.incidents.domain.entities import IncidentStatus
from neirapp.modules.incidents.presentation.dependencies import IncidentsDep
from neirapp.modules.incidents.presentation.schemas import (
    IncidentResponse,
    ReportIncidentRequest,
    ResolveIncidentRequest,
)

RequireAdmin = Annotated[User, Depends(require_roles(Role.ADMIN))]

router = APIRouter(prefix="/incidents", tags=["incidents"])


@router.post("", response_model=IncidentResponse, status_code=201)
async def report_incident(
    body: ReportIncidentRequest, user: CurrentUser, incidents: IncidentsDep
) -> IncidentResponse:
    incident = await incidents.report_incident(
        body.order_id, user.id, category=body.category, description=body.description
    )
    return IncidentResponse.from_domain(incident)


@router.get("/mine", response_model=list[IncidentResponse])
async def list_my_incidents(user: CurrentUser, incidents: IncidentsDep) -> list[IncidentResponse]:
    my_incidents = await incidents.list_my_incidents(user.id)
    return [IncidentResponse.from_domain(i) for i in my_incidents]


@router.get("", response_model=list[IncidentResponse])
async def list_incidents(
    _admin: RequireAdmin,
    incidents: IncidentsDep,
    status: Annotated[IncidentStatus | None, Query()] = None,
) -> list[IncidentResponse]:
    all_incidents = await incidents.list_incidents(status=status)
    return [IncidentResponse.from_domain(i) for i in all_incidents]


@router.patch("/{incident_id}/resolve", response_model=IncidentResponse)
async def resolve_incident(
    incident_id: UUID, body: ResolveIncidentRequest, _admin: RequireAdmin, incidents: IncidentsDep
) -> IncidentResponse:
    incident = await incidents.resolve_incident(
        incident_id, status=body.status, resolution_note=body.resolution_note
    )
    return IncidentResponse.from_domain(incident)
