from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from uuid import UUID, uuid4

from neirapp.modules.incidents.domain.errors import EmptyDescription, IncidentAlreadyResolved

MAX_DESCRIPTION_LENGTH = 1000


class ReporterRole(StrEnum):
    CUSTOMER = "customer"
    COURIER = "courier"


class IncidentCategory(StrEnum):
    WRONG_ITEM = "wrong_item"
    MISSING_ITEM = "missing_item"
    DAMAGED = "damaged"
    LATE_DELIVERY = "late_delivery"
    OTHER = "other"


class IncidentStatus(StrEnum):
    OPEN = "open"
    RESOLVED = "resolved"
    DISMISSED = "dismissed"


_TRANSITIONS: dict[IncidentStatus, frozenset[IncidentStatus]] = {
    IncidentStatus.OPEN: frozenset({IncidentStatus.RESOLVED, IncidentStatus.DISMISSED}),
    IncidentStatus.RESOLVED: frozenset(),
    IncidentStatus.DISMISSED: frozenset(),
}


@dataclass
class Incident:
    """Reporte de un problema con un pedido. `reporter_user_id` es siempre el `user_id` de
    `identity` (nunca un id propio de otro módulo) — mismo motivo que `Delivery.courier_id` en
    `dispatch` (ver docs/ARCHITECTURE.md, "courier_id es el user_id de identity")."""

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
    def report(
        cls,
        *,
        order_id: UUID,
        reporter_user_id: UUID,
        reporter_role: ReporterRole,
        category: IncidentCategory,
        description: str,
        now: datetime,
    ) -> "Incident":
        normalized = description.strip()[:MAX_DESCRIPTION_LENGTH]
        if not normalized:
            raise EmptyDescription()
        return cls(
            id=uuid4(),
            order_id=order_id,
            reporter_user_id=reporter_user_id,
            reporter_role=reporter_role,
            category=category,
            description=normalized,
            status=IncidentStatus.OPEN,
            resolution_note=None,
            created_at=now,
            resolved_at=None,
        )

    def resolve(
        self, *, status: IncidentStatus, resolution_note: str | None, now: datetime
    ) -> None:
        if status not in _TRANSITIONS[self.status]:
            raise IncidentAlreadyResolved()
        self.status = status
        self.resolution_note = (
            resolution_note.strip()[:MAX_DESCRIPTION_LENGTH] if resolution_note else None
        )
        self.resolved_at = now

    def is_reported_by(self, user_id: UUID) -> bool:
        return self.reporter_user_id == user_id
