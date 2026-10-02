from dataclasses import dataclass
from datetime import date, datetime
from enum import StrEnum
from uuid import UUID, uuid4

from neirapp.modules.lodging.domain.errors import (
    InvalidReservation,
    InvalidReservationTransition,
)

MAX_NIGHTS = 60
MAX_GUESTS = 50
MAX_ROOMS = 20
MAX_MESSAGE = 500
MAX_NOTE = 300


class ReservationStatus(StrEnum):
    PENDING = "pending"  # Esperando que el hotel responda
    CONFIRMED = "confirmed"  # El hotel la aceptó
    DECLINED = "declined"  # El hotel no tiene disponibilidad
    CANCELLED = "cancelled"  # La canceló el huésped


@dataclass(frozen=True)
class ReservationData:
    check_in: date
    check_out: date
    guests: int
    phone: str
    rooms: int = 1
    message: str = ""


@dataclass
class Reservation:
    """Una solicitud de reserva. NeirAPP no cobra: el hotel confirma y el pago se acuerda con él."""

    id: UUID
    hotel_id: UUID
    customer_id: UUID
    customer_name: str
    phone: str
    check_in: date
    check_out: date
    guests: int
    rooms: int
    message: str
    status: ReservationStatus
    hotel_note: str
    created_at: datetime
    updated_at: datetime

    @classmethod
    def request(
        cls, hotel_id: UUID, customer_id: UUID, name: str, data: ReservationData, today: date,
        now: datetime,
    ) -> "Reservation":  # fmt: skip
        digits = "".join(ch for ch in data.phone if ch.isdigit())
        if len(digits) == 12 and digits.startswith("57"):
            digits = digits[2:]
        nights = (data.check_out - data.check_in).days
        message = data.message.strip()
        if (
            data.check_in < today
            or not 1 <= nights <= MAX_NIGHTS
            or not 1 <= data.guests <= MAX_GUESTS
            or not 1 <= data.rooms <= MAX_ROOMS
            or len(message) > MAX_MESSAGE
            or not (len(digits) == 10 and digits.startswith("3"))
        ):
            raise InvalidReservation()
        return cls(
            uuid4(), hotel_id, customer_id, name, digits, data.check_in, data.check_out,
            data.guests, data.rooms, message, ReservationStatus.PENDING, "", now, now,
        )  # fmt: skip

    @property
    def nights(self) -> int:
        return (self.check_out - self.check_in).days

    def _move(self, to: ReservationStatus, note: str, now: datetime) -> None:
        if self.status is not ReservationStatus.PENDING and not (
            self.status is ReservationStatus.CONFIRMED and to is ReservationStatus.CANCELLED
        ):
            raise InvalidReservationTransition()
        self.status = to
        self.hotel_note = " ".join(note.split())[:MAX_NOTE] or self.hotel_note
        self.updated_at = now

    def confirm(self, note: str, now: datetime) -> None:
        self._move(ReservationStatus.CONFIRMED, note, now)

    def decline(self, note: str, now: datetime) -> None:
        self._move(ReservationStatus.DECLINED, note, now)

    def cancel(self, now: datetime) -> None:
        self._move(ReservationStatus.CANCELLED, "", now)
