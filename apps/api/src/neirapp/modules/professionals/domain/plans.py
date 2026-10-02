from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import StrEnum
from uuid import UUID, uuid4

from neirapp.modules.professionals.domain.errors import (
    InvalidPaymentReference,
    InvalidSubscriptionTransition,
    MissingReviewNote,
)

PLAN_DAYS = 30
MAX_REFERENCE = 120
MAX_PLAN_NOTE = 300


class PlanId(StrEnum):
    BASIC = "basic"
    PRO = "pro"
    PREMIUM = "premium"


@dataclass(frozen=True)
class PlanSpec:
    """Lo que habilita cada plan. Los textos de venta están en el frontend (`plans.js`)."""

    id: PlanId
    name: str
    price_cop: int
    max_images: int
    shows_certificates: bool  # Certificados verificados (y la insignia) visibles en su perfil
    receives_requests: bool  # Las personas le pueden pedir citas desde su perfil
    featured: bool  # Aparece primero en su especialidad


PLANS: dict[PlanId, PlanSpec] = {
    PlanId.BASIC: PlanSpec(PlanId.BASIC, "Básico", 14_900, 3, False, False, False),
    PlanId.PRO: PlanSpec(PlanId.PRO, "Profesional", 29_900, 20, True, True, False),
    # "Galería ilimitada": el tope solo evita abusos.
    PlanId.PREMIUM: PlanSpec(PlanId.PREMIUM, "Premium", 59_900, 100, True, True, True),
}

MAX_PLAN_IMAGES = max(p.max_images for p in PLANS.values())

# Sin plan activo el perfil no se publica; mientras tanto puede prepararlo con lo del Básico.
NO_PLAN_MAX_IMAGES = PLANS[PlanId.BASIC].max_images


class SubscriptionStatus(StrEnum):
    PENDING = "pending"  # Eligió el plan; espera que el administrador confirme el pago
    ACTIVE = "active"  # Pago confirmado: vale de `starts_at` a `expires_at`
    REJECTED = "rejected"  # El administrador no encontró el pago
    CANCELLED = "cancelled"  # El profesional retiró la solicitud antes de que la revisaran


def clean_reference(raw: str) -> str:
    reference = " ".join(raw.split())
    if len(reference) > MAX_REFERENCE:
        raise InvalidPaymentReference()
    return reference


@dataclass
class Subscription:
    """Un mes de un plan: lo pide el profesional y lo activa el administrador al ver el pago (o se
    lo activa él directamente). El plan vigente es el activo cuyo periodo incluye hoy."""

    id: UUID
    user_id: UUID
    plan: PlanId
    status: SubscriptionStatus
    payment_reference: str
    note: str
    requested_at: datetime
    reviewed_at: datetime | None = None
    starts_at: datetime | None = None
    expires_at: datetime | None = None

    @classmethod
    def request(
        cls, user_id: UUID, plan: PlanId, payment_reference: str, now: datetime
    ) -> "Subscription":
        return cls(
            id=uuid4(),
            user_id=user_id,
            plan=plan,
            status=SubscriptionStatus.PENDING,
            payment_reference=clean_reference(payment_reference),
            note="",
            requested_at=now,
        )

    def activate(self, starts_at: datetime, now: datetime) -> None:
        if self.status is not SubscriptionStatus.PENDING:
            raise InvalidSubscriptionTransition()
        self.status = SubscriptionStatus.ACTIVE
        self.reviewed_at = now
        self.starts_at = starts_at
        self.expires_at = starts_at + timedelta(days=PLAN_DAYS)

    def reject(self, note: str, now: datetime) -> None:
        if self.status is not SubscriptionStatus.PENDING:
            raise InvalidSubscriptionTransition()
        note = " ".join(note.split())
        if not note:
            raise MissingReviewNote()
        self.status = SubscriptionStatus.REJECTED
        self.note = note[:MAX_PLAN_NOTE]
        self.reviewed_at = now

    def cancel(self) -> None:
        if self.status is not SubscriptionStatus.PENDING:
            raise InvalidSubscriptionTransition()
        self.status = SubscriptionStatus.CANCELLED

    def end(self, now: datetime) -> None:
        """Lo termina antes de tiempo (cambio de plan o el administrador lo quita)."""
        if self.expires_at is not None and self.expires_at > now:
            self.expires_at = max(now, self.starts_at or now)

    def is_current(self, now: datetime) -> bool:
        return (
            self.status is SubscriptionStatus.ACTIVE
            and self.starts_at is not None
            and self.expires_at is not None
            and self.starts_at <= now < self.expires_at
        )

    def is_upcoming(self, now: datetime) -> bool:
        """Una renovación ya pagada que empieza cuando venza el periodo actual."""
        return (
            self.status is SubscriptionStatus.ACTIVE
            and self.starts_at is not None
            and self.expires_at is not None
            and now < self.starts_at < self.expires_at
        )


def current_of(subscriptions: list[Subscription], now: datetime) -> Subscription | None:
    current = [s for s in subscriptions if s.is_current(now)]
    return max(current, key=lambda s: s.starts_at or now) if current else None


def paid_until(subscriptions: list[Subscription], plan: PlanId, now: datetime) -> datetime | None:
    """Hasta cuándo tiene pagado ese mismo plan, contando renovaciones ya activadas."""
    ends = [
        s.expires_at
        for s in subscriptions
        if s.plan is plan and (s.is_current(now) or s.is_upcoming(now)) and s.expires_at
    ]
    return max(ends) if ends else None
