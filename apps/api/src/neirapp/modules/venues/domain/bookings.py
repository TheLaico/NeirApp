from dataclasses import dataclass
from datetime import date, datetime, timedelta
from enum import StrEnum
from uuid import UUID, uuid4

from neirapp.modules.venues.domain.errors import (
    InvalidBooking,
    InvalidBookingTransition,
    TooManyPeople,
    VenueClosed,
)
from neirapp.modules.venues.domain.venues import Venue, as_time

MAX_DAYS_AHEAD = 180
MAX_MESSAGE = 500
MAX_NOTE = 300


class BookingStatus(StrEnum):
    PENDING = "pending"  # Esperando que el lugar responda
    CONFIRMED = "confirmed"  # El lugar la aceptó
    DECLINED = "declined"  # El lugar no tiene disponibilidad
    CANCELLED = "cancelled"  # La canceló el cliente


@dataclass(frozen=True)
class BookingData:
    day: date
    at: str  # "HH:MM"
    people: int
    phone: str
    message: str = ""


@dataclass
class Booking:
    """Una solicitud de reserva (mesa, cancha, salón…). NeirAPP no cobra: el lugar confirma y el
    pago, si lo hay, se acuerda con él."""

    id: UUID
    venue_id: UUID
    customer_id: UUID
    customer_name: str
    phone: str
    day: date
    at: str
    people: int
    message: str
    status: BookingStatus
    venue_note: str
    created_at: datetime
    updated_at: datetime

    @classmethod
    def request(
        cls, venue: Venue, customer_id: UUID, name: str, data: BookingData, local_now: datetime,
        now: datetime,
    ) -> "Booking":  # fmt: skip
        """`local_now` es la hora de Colombia: con ella se ve si la fecha y la hora ya pasaron."""
        digits = "".join(ch for ch in data.phone if ch.isdigit())
        if len(digits) == 12 and digits.startswith("57"):
            digits = digits[2:]
        message = data.message.strip()
        try:
            at = as_time(data.at)
        except ValueError:
            raise InvalidBooking() from None
        today = local_now.date()
        if (
            not today <= data.day <= today + timedelta(days=MAX_DAYS_AHEAD)
            or (data.day == today and at <= local_now.time().replace(tzinfo=None))
            or data.people < 1
            or len(message) > MAX_MESSAGE
            or not (len(digits) == 10 and digits.startswith("3"))
        ):
            raise InvalidBooking()
        if data.people > venue.max_people:
            raise TooManyPeople(
                f"Este lugar recibe hasta {venue.max_people} personas por reserva. "
                "Para grupos más grandes escríbeles directamente."
            )
        if not venue.is_open_at(data.day.weekday(), at):
            raise VenueClosed()
        return cls(
            uuid4(), venue.user_id, customer_id, name, digits, data.day, at.strftime("%H:%M"),
            data.people, message, BookingStatus.PENDING, "", now, now,
        )  # fmt: skip

    @property
    def starts(self) -> datetime:
        return datetime.combine(self.day, as_time(self.at))

    def _move(self, to: BookingStatus, note: str, now: datetime) -> None:
        if self.status is not BookingStatus.PENDING and not (
            self.status is BookingStatus.CONFIRMED and to is BookingStatus.CANCELLED
        ):
            raise InvalidBookingTransition()
        self.status = to
        self.venue_note = " ".join(note.split())[:MAX_NOTE] or self.venue_note
        self.updated_at = now

    def confirm(self, note: str, now: datetime) -> None:
        self._move(BookingStatus.CONFIRMED, note, now)

    def decline(self, note: str, now: datetime) -> None:
        self._move(BookingStatus.DECLINED, note, now)

    def cancel(self, now: datetime) -> None:
        self._move(BookingStatus.CANCELLED, "", now)
