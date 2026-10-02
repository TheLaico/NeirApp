from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import StrEnum
from uuid import UUID, uuid4

from neirapp.modules.lodging.domain.errors import (
    InvalidPaymentReference,
    InvalidPaymentTransition,
    MissingNote,
)

PLAN_DAYS = 30
MAX_REFERENCE = 120
MAX_NOTE = 300


class PlanKind(StrEnum):
    LISTING = "listing"  # Aparecer en Hospedaje
    FEATURED = "featured"  # Salir en "Hoteles recomendados" y primero en la lista


# Precio de cada mes, en pesos.
PLAN_FEES_COP = {PlanKind.LISTING: 25_000, PlanKind.FEATURED: 4_900}


class PaymentStatus(StrEnum):
    PENDING = "pending"  # El hotel dice que pagó; el administrador lo confirma
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


@dataclass
class HotelPayment:
    """Un mes de un plan (aparecer o destacarse). No hay pasarela: el hotel paga por fuera, reporta
    el comprobante y el administrador lo confirma (o lo activa él mismo); ahí corre 30 días."""

    id: UUID
    hotel_id: UUID
    kind: PlanKind
    status: PaymentStatus
    amount_cop: int
    reference: str
    note: str
    requested_at: datetime
    reviewed_at: datetime | None = None
    starts_at: datetime | None = None
    expires_at: datetime | None = None

    @classmethod
    def request(
        cls, hotel_id: UUID, kind: PlanKind, reference: str, now: datetime
    ) -> "HotelPayment":
        reference = " ".join(reference.split())
        if len(reference) > MAX_REFERENCE:
            raise InvalidPaymentReference()
        return cls(
            id=uuid4(),
            hotel_id=hotel_id,
            kind=kind,
            status=PaymentStatus.PENDING,
            amount_cop=PLAN_FEES_COP[kind],
            reference=reference,
            note="",
            requested_at=now,
        )

    def approve(self, starts_at: datetime, now: datetime) -> None:
        if self.status is not PaymentStatus.PENDING:
            raise InvalidPaymentTransition()
        self.status = PaymentStatus.APPROVED
        self.reviewed_at = now
        self.starts_at = starts_at
        self.expires_at = starts_at + timedelta(days=PLAN_DAYS)

    def reject(self, note: str, now: datetime) -> None:
        if self.status is not PaymentStatus.PENDING:
            raise InvalidPaymentTransition()
        note = " ".join(note.split())
        if not note:
            raise MissingNote()
        self.status = PaymentStatus.REJECTED
        self.note = note[:MAX_NOTE]
        self.reviewed_at = now

    def cancel(self) -> None:
        if self.status is not PaymentStatus.PENDING:
            raise InvalidPaymentTransition()
        self.status = PaymentStatus.CANCELLED
