from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from uuid import UUID, uuid4

from neirapp.modules.marketplace.domain.errors import InvalidReportDetails

MAX_DETAILS = 500


class ReportReason(StrEnum):
    INAPPROPRIATE = "inappropriate"  # Contenido inapropiado u ofensivo
    SCAM = "scam"  # Posible estafa o fraude
    MISLEADING = "misleading"  # Información falsa o engañosa
    PROHIBITED = "prohibited"  # No es un inmueble o es contenido prohibido
    SPAM = "spam"  # Spam o publicación repetida
    OTHER = "other"


class ReportStatus(StrEnum):
    OPEN = "open"
    DISMISSED = "dismissed"  # El equipo la revisó y no encontró problema
    ACTIONED = "actioned"  # El equipo retiró la publicación


@dataclass
class Report:
    """Alguien avisa que una publicación es inadecuada; el equipo la revisa."""

    id: UUID
    listing_id: UUID
    reporter_id: UUID
    reason: ReportReason
    details: str
    status: ReportStatus
    created_at: datetime
    reviewed_at: datetime | None = None

    @classmethod
    def create(
        cls, listing_id: UUID, reporter_id: UUID, reason: ReportReason, details: str, now: datetime
    ) -> "Report":
        details = details.strip()
        if len(details) > MAX_DETAILS or (reason is ReportReason.OTHER and len(details) < 5):
            raise InvalidReportDetails()
        return cls(uuid4(), listing_id, reporter_id, reason, details, ReportStatus.OPEN, now)

    def close(self, status: ReportStatus, now: datetime) -> None:
        self.status = status
        self.reviewed_at = now
