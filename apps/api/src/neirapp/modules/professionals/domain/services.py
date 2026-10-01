from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from uuid import UUID, uuid4

from neirapp.modules.professionals.domain.errors import (
    InvalidServiceDuration,
    InvalidServiceName,
    InvalidServicePrice,
    TextTooLong,
)

MAX_SERVICES = 30
MAX_SERVICE_NAME = 80
MAX_SERVICE_DESCRIPTION = 300
MIN_PRICE_COP = 1_000
MAX_PRICE_COP = 50_000_000
MIN_DURATION = 5
MAX_DURATION = 12 * 60


class PriceKind(StrEnum):
    FIXED = "fixed"  # "$80.000"
    FROM = "from"  # "Desde $80.000"
    QUOTE = "quote"  # "A convenir"


@dataclass(frozen=True)
class ServiceData:
    """Lo que el profesional escribe al crear o editar un servicio (sin validar)."""

    name: str
    description: str = ""
    price_kind: PriceKind = PriceKind.QUOTE
    price_cop: int | None = None
    duration_minutes: int | None = None
    is_active: bool = True


@dataclass
class ProfessionalService:
    """Servicio que ofrece un profesional (consulta, visita…) con su precio de referencia."""

    id: UUID
    user_id: UUID
    name: str
    description: str
    price_kind: PriceKind
    price_cop: int | None
    duration_minutes: int | None
    is_active: bool
    position: int
    created_at: datetime
    updated_at: datetime

    @classmethod
    def create(
        cls, user_id: UUID, data: ServiceData, position: int, now: datetime
    ) -> "ProfessionalService":
        service = cls(
            id=uuid4(),
            user_id=user_id,
            name="",
            description="",
            price_kind=PriceKind.QUOTE,
            price_cop=None,
            duration_minutes=None,
            is_active=True,
            position=position,
            created_at=now,
            updated_at=now,
        )
        service.update(data, now)
        return service

    def update(self, data: ServiceData, now: datetime) -> None:
        name = " ".join(data.name.split())
        if not 3 <= len(name) <= MAX_SERVICE_NAME:
            raise InvalidServiceName()
        description = data.description.strip()
        if len(description) > MAX_SERVICE_DESCRIPTION:
            raise TextTooLong()
        if data.price_kind is PriceKind.QUOTE:
            price = None
        elif data.price_cop is None or not MIN_PRICE_COP <= data.price_cop <= MAX_PRICE_COP:
            raise InvalidServicePrice()
        else:
            price = data.price_cop
        duration = data.duration_minutes
        if duration is not None and not MIN_DURATION <= duration <= MAX_DURATION:
            raise InvalidServiceDuration()

        self.name = name
        self.description = description
        self.price_kind = data.price_kind
        self.price_cop = price
        self.duration_minutes = duration
        self.is_active = data.is_active
        self.updated_at = now
