from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import StrEnum
from uuid import UUID, uuid4

from neirapp.modules.marketplace.domain.errors import (
    InvalidPaymentReference,
    InvalidPaymentTransition,
    MissingNote,
)

LISTING_FEE_COP = 10_000  # Por publicación y por mes
LISTING_DAYS = 30
MAX_REFERENCE = 120
MAX_NOTE = 300


class PaymentStatus(StrEnum):
    PENDING = "pending"  # El vendedor dice que pagó; el administrador lo confirma
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


@dataclass
class ListingPayment:
    """Un mes de publicación. No hay pasarela: el vendedor paga por fuera, reporta el comprobante
    y el administrador lo confirma; ahí la publicación queda visible 30 días más."""

    id: UUID
    listing_id: UUID
    seller_id: UUID
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
        cls, listing_id: UUID, seller_id: UUID, reference: str, now: datetime
    ) -> "ListingPayment":
        reference = " ".join(reference.split())
        if len(reference) > MAX_REFERENCE:
            raise InvalidPaymentReference()
        return cls(
            id=uuid4(),
            listing_id=listing_id,
            seller_id=seller_id,
            status=PaymentStatus.PENDING,
            amount_cop=LISTING_FEE_COP,
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
        self.expires_at = starts_at + timedelta(days=LISTING_DAYS)

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
