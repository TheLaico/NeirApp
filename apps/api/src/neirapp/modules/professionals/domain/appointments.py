from dataclasses import dataclass
from datetime import date, datetime
from enum import StrEnum
from uuid import UUID, uuid4

from neirapp.modules.professionals.domain.entities import normalize_mobile
from neirapp.modules.professionals.domain.errors import (
    InvalidAppointmentRequest,
    InvalidRequestTransition,
)

MAX_MESSAGE = 500
MAX_ADDRESS = 160
MAX_NOTE = 300
MAX_PENDING_PER_PROFESSIONAL = 3


class Modality(StrEnum):
    OFFICE = "office"
    HOME = "home"
    ONLINE = "online"


class TimeSlot(StrEnum):
    MORNING = "morning"
    AFTERNOON = "afternoon"
    EVENING = "evening"
    ANY = "any"


class RequestStatus(StrEnum):
    PENDING = "pending"  # Esperando respuesta del profesional
    SCHEDULED = "scheduled"  # Aceptada, con fecha y hora
    REJECTED = "rejected"
    CANCELLED = "cancelled"
    COMPLETED = "completed"  # La cita ya se hizo


OPEN_STATUSES = frozenset({RequestStatus.PENDING, RequestStatus.SCHEDULED})


@dataclass(frozen=True)
class RequestData:
    """Lo que el cliente escribe al pedir una cita (sin validar)."""

    modality: Modality
    message: str
    phone: str
    preferred_date: date | None = None
    preferred_time: TimeSlot = TimeSlot.ANY
    address: str = ""
    service_id: UUID | None = None


def _clean(text: str, limit: int, *, multiline: bool = False) -> str:
    value = text.strip() if multiline else " ".join(text.split())
    if len(value) > limit:
        raise InvalidAppointmentRequest("Uno de los textos es demasiado largo.")
    return value


@dataclass
class AppointmentRequest:
    """Una persona le pide una cita a un profesional, que la programa, rechaza o da por hecha."""

    id: UUID
    professional_id: UUID
    customer_id: UUID
    customer_name: str
    customer_phone: str
    modality: Modality
    preferred_date: date | None
    preferred_time: TimeSlot
    message: str
    address: str
    service_id: UUID | None
    service_name: str
    status: RequestStatus
    scheduled_at: datetime | None
    note: str  # Del profesional (motivo del rechazo, indicaciones) o de quien cancela
    cancelled_by_customer: bool
    created_at: datetime
    updated_at: datetime

    @classmethod
    def create(
        cls,
        *,
        professional_id: UUID,
        customer_id: UUID,
        customer_name: str,
        data: RequestData,
        offered: set[Modality],
        service_name: str,
        now: datetime,
    ) -> "AppointmentRequest":
        if data.modality not in offered:
            raise InvalidAppointmentRequest("Este profesional no atiende de esa forma.")
        message = _clean(data.message, MAX_MESSAGE, multiline=True)
        if len(message) < 10:
            raise InvalidAppointmentRequest(
                "Cuéntale al profesional qué necesitas (al menos 10 letras)."
            )
        address = _clean(data.address, MAX_ADDRESS)
        if data.modality is Modality.HOME and len(address) < 5:
            raise InvalidAppointmentRequest("Escribe la dirección para la visita a domicilio.")
        if data.preferred_date is not None and data.preferred_date < now.date():
            raise InvalidAppointmentRequest("La fecha que prefieres ya pasó.")
        return cls(
            id=uuid4(),
            professional_id=professional_id,
            customer_id=customer_id,
            customer_name=" ".join(customer_name.split())[:80],
            customer_phone=normalize_mobile(data.phone),
            modality=data.modality,
            preferred_date=data.preferred_date,
            preferred_time=data.preferred_time,
            message=message,
            address=address if data.modality is Modality.HOME else "",
            service_id=data.service_id,
            service_name=service_name,
            status=RequestStatus.PENDING,
            scheduled_at=None,
            note="",
            cancelled_by_customer=False,
            created_at=now,
            updated_at=now,
        )

    def _require(self, *allowed: RequestStatus) -> None:
        if self.status not in allowed:
            raise InvalidRequestTransition()

    def schedule(self, when: datetime, note: str, now: datetime) -> None:
        """Acepta (o reprograma) la cita para `when`."""
        self._require(RequestStatus.PENDING, RequestStatus.SCHEDULED)
        if when <= now:
            raise InvalidAppointmentRequest("Elige una fecha y hora que todavía no hayan pasado.")
        self.status = RequestStatus.SCHEDULED
        self.scheduled_at = when
        self.note = _clean(note, MAX_NOTE)
        self.updated_at = now

    def reject(self, note: str, now: datetime) -> None:
        self._require(RequestStatus.PENDING)
        self.status = RequestStatus.REJECTED
        self.note = _clean(note, MAX_NOTE)
        self.updated_at = now

    def complete(self, now: datetime) -> None:
        self._require(RequestStatus.SCHEDULED)
        self.status = RequestStatus.COMPLETED
        self.updated_at = now

    def cancel(self, *, by_customer: bool, note: str, now: datetime) -> None:
        self._require(*OPEN_STATUSES)
        self.status = RequestStatus.CANCELLED
        self.cancelled_by_customer = by_customer
        self.note = _clean(note, MAX_NOTE)
        self.updated_at = now
