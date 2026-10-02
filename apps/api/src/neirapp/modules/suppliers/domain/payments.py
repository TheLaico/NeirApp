from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import StrEnum
from uuid import UUID, uuid4

from neirapp.modules.suppliers.domain.errors import (
    InvalidPaymentReference,
    InvalidPaymentTransition,
    MissingNote,
)

SUBSCRIPTION_FEE_COP = 24_900  # Por mes: aparecer en Proveedores y publicar el catálogo
SUBSCRIPTION_DAYS = 30
MAX_REFERENCE = 120
MAX_NOTE = 300


class PaymentStatus(StrEnum):
    PENDING = "pending"  # La empresa dice que pagó; el administrador lo confirma
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


@dataclass
class SupplierPayment:
    """Un mes de suscripción. No hay pasarela: la empresa paga por fuera, reporta el comprobante y
    el administrador lo confirma (o la activa él mismo); ahí aparece 30 días más en Proveedores."""

    id: UUID
    supplier_id: UUID
    status: PaymentStatus
    amount_cop: int
    reference: str
    note: str
    requested_at: datetime
    reviewed_at: datetime | None = None
    starts_at: datetime | None = None
    expires_at: datetime | None = None

    @classmethod
    def request(cls, supplier_id: UUID, reference: str, now: datetime) -> "SupplierPayment":
        reference = " ".join(reference.split())
        if len(reference) > MAX_REFERENCE:
            raise InvalidPaymentReference()
        return cls(
            id=uuid4(),
            supplier_id=supplier_id,
            status=PaymentStatus.PENDING,
            amount_cop=SUBSCRIPTION_FEE_COP,
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
        self.expires_at = starts_at + timedelta(days=SUBSCRIPTION_DAYS)

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
