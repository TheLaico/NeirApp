from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import StrEnum
from uuid import UUID, uuid4

from neirapp.modules.stores.domain.errors import (
    InvalidPromotionReference,
    InvalidPromotionTransition,
    MissingPromotionNote,
)

# El comerciante paga $ 7.000 y su producto sale en "Productos recomendados" del inicio, dentro de
# la categoría de su tienda, durante estos días.
PROMOTION_FEE_COP = 7_000
PROMOTION_DAYS = 30
MAX_REFERENCE = 120
MAX_NOTE = 300


class PromotionStatus(StrEnum):
    PENDING = "pending"  # El comerciante dice que pagó; el administrador lo confirma
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


@dataclass
class ProductPromotion:
    """Destacar un producto del catálogo de una tienda (de los que van al carrito). No hay
    pasarela (igual que los planes de Hospedaje): el comerciante paga por fuera, reporta el
    comprobante y el administrador lo confirma; ahí corren los días."""

    id: UUID
    store_id: UUID
    product_id: UUID
    status: PromotionStatus
    amount_cop: int
    reference: str
    note: str
    requested_at: datetime
    reviewed_at: datetime | None = None
    starts_at: datetime | None = None
    expires_at: datetime | None = None

    @classmethod
    def request(
        cls, store_id: UUID, product_id: UUID, reference: str, now: datetime
    ) -> "ProductPromotion":
        reference = " ".join(reference.split())
        if len(reference) > MAX_REFERENCE:
            raise InvalidPromotionReference()
        return cls(
            id=uuid4(),
            store_id=store_id,
            product_id=product_id,
            status=PromotionStatus.PENDING,
            amount_cop=PROMOTION_FEE_COP,
            reference=reference,
            note="",
            requested_at=now,
        )

    def is_active(self, now: datetime) -> bool:
        return (
            self.status is PromotionStatus.APPROVED
            and self.starts_at is not None
            and self.expires_at is not None
            and self.starts_at <= now < self.expires_at
        )

    def approve(self, starts_at: datetime, now: datetime) -> None:
        if self.status is not PromotionStatus.PENDING:
            raise InvalidPromotionTransition()
        self.status = PromotionStatus.APPROVED
        self.reviewed_at = now
        self.starts_at = starts_at
        self.expires_at = starts_at + timedelta(days=PROMOTION_DAYS)

    def reject(self, note: str, now: datetime) -> None:
        if self.status is not PromotionStatus.PENDING:
            raise InvalidPromotionTransition()
        note = " ".join(note.split())
        if not note:
            raise MissingPromotionNote()
        self.status = PromotionStatus.REJECTED
        self.note = note[:MAX_NOTE]
        self.reviewed_at = now

    def cancel(self) -> None:
        if self.status is not PromotionStatus.PENDING:
            raise InvalidPromotionTransition()
        self.status = PromotionStatus.CANCELLED

    def end(self, now: datetime) -> None:
        """El administrador la quita desde ya (si todavía no empezaba, tampoco empieza)."""
        if self.status is not PromotionStatus.APPROVED or self.expires_at is None:
            raise InvalidPromotionTransition()
        if self.expires_at > now:
            self.expires_at = now
            if self.starts_at is not None and self.starts_at > now:
                self.starts_at = now
