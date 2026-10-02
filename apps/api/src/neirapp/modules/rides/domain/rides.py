from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import StrEnum
from uuid import UUID, uuid4

from neirapp.modules.rides.domain.errors import (
    InvalidLocation,
    InvalidRating,
    InvalidRideRequest,
    InvalidRideTransition,
)
from neirapp.modules.rides.domain.geo import in_neira

FARE_PER_PERSON_COP = 2_500
MAX_PASSENGERS = 3
MAX_TEXT = 120
MAX_COMMENT = 300
# Una solicitud que nadie acepta en este tiempo se vence (el cliente puede volver a pedir).
REQUEST_TTL = timedelta(minutes=15)


class RideStatus(StrEnum):
    REQUESTED = "requested"  # Esperando que un conductor la acepte
    ACCEPTED = "accepted"  # Un conductor va en camino a recoger
    ARRIVED = "arrived"  # El conductor llegó al punto de recogida
    IN_PROGRESS = "in_progress"  # Ya van en el motocarro
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    EXPIRED = "expired"  # Nadie la aceptó a tiempo


ACTIVE = {RideStatus.REQUESTED, RideStatus.ACCEPTED, RideStatus.ARRIVED, RideStatus.IN_PROGRESS}
# Estados en los que el viaje ya tiene conductor y sigue abierto.
ASSIGNED = {RideStatus.ACCEPTED, RideStatus.ARRIVED, RideStatus.IN_PROGRESS}


@dataclass(frozen=True)
class RideData:
    passengers: int
    lat: float
    lng: float
    address: str
    reference: str = ""
    destination: str = ""


def _text(raw: str) -> str:
    text = " ".join(raw.split())
    if len(text) > MAX_TEXT:
        raise InvalidRideRequest()
    return text


@dataclass
class Ride:
    """Un viaje en motocarro. El cliente pide desde un punto (con cuántas personas van, máximo 3) y
    el primer conductor que acepta se lo lleva. La tarifa es de $ 2.500 por persona y se paga al
    conductor."""

    id: UUID
    customer_id: UUID
    customer_name: str
    customer_phone: str
    passengers: int
    pickup_lat: float
    pickup_lng: float
    address: str
    reference: str
    destination: str
    fare_cop: int
    status: RideStatus
    requested_at: datetime
    driver_id: UUID | None = None
    accepted_at: datetime | None = None
    arrived_at: datetime | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    cancelled_at: datetime | None = None
    cancelled_by: str = ""  # "customer" o "driver"
    # Ubicación en vivo que comparte el cliente mientras espera (opcional).
    customer_lat: float | None = None
    customer_lng: float | None = None
    customer_located_at: datetime | None = None
    rating: int = 0
    rating_comment: str = ""

    @classmethod
    def request(
        cls, customer_id: UUID, name: str, phone: str, data: RideData, now: datetime
    ) -> "Ride":
        if not 1 <= data.passengers <= MAX_PASSENGERS:
            raise InvalidRideRequest("Pueden ir de 1 a 3 personas por motocarro.")
        if not in_neira(data.lat, data.lng):
            raise InvalidLocation()
        address = _text(data.address)
        if len(address) < 3:
            raise InvalidRideRequest(
                "Escribe la dirección o un punto de referencia para recogerte."
            )
        return cls(
            id=uuid4(),
            customer_id=customer_id,
            customer_name=name,
            customer_phone=phone,
            passengers=data.passengers,
            pickup_lat=round(data.lat, 6),
            pickup_lng=round(data.lng, 6),
            address=address,
            reference=_text(data.reference),
            destination=_text(data.destination),
            fare_cop=FARE_PER_PERSON_COP * data.passengers,
            status=RideStatus.REQUESTED,
            requested_at=now,
        )

    @property
    def is_active(self) -> bool:
        return self.status in ACTIVE

    def expire_if_due(self, now: datetime) -> bool:
        """Vence la solicitud si nadie la aceptó a tiempo. Devuelve si cambió."""
        if self.status is RideStatus.REQUESTED and now - self.requested_at >= REQUEST_TTL:
            self.status = RideStatus.EXPIRED
            return True
        return False

    def _require(self, *allowed: RideStatus) -> None:
        if self.status not in allowed:
            raise InvalidRideTransition()

    def accept(self, driver_id: UUID, now: datetime) -> None:
        """Lo asigna en memoria; el repositorio lo confirma solo si nadie más lo tomó antes."""
        self._require(RideStatus.REQUESTED)
        self.status = RideStatus.ACCEPTED
        self.driver_id = driver_id
        self.accepted_at = now

    def mark_arrived(self, now: datetime) -> None:
        self._require(RideStatus.ACCEPTED)
        self.status = RideStatus.ARRIVED
        self.arrived_at = now

    def start(self, now: datetime) -> None:
        self._require(RideStatus.ACCEPTED, RideStatus.ARRIVED)
        self.status = RideStatus.IN_PROGRESS
        self.started_at = now

    def complete(self, now: datetime) -> None:
        self._require(RideStatus.IN_PROGRESS)
        self.status = RideStatus.COMPLETED
        self.completed_at = now

    def cancel(self, by: str, now: datetime) -> None:
        # Una vez van en el motocarro ya no se cancela: se termina el viaje.
        self._require(RideStatus.REQUESTED, RideStatus.ACCEPTED, RideStatus.ARRIVED)
        if by == "driver" and self.status is RideStatus.REQUESTED:
            raise InvalidRideTransition()
        self.status = RideStatus.CANCELLED
        self.cancelled_at = now
        self.cancelled_by = by

    def share_location(self, lat: float, lng: float, now: datetime) -> None:
        if not self.is_active:
            raise InvalidRideTransition()
        if not in_neira(lat, lng):
            raise InvalidLocation()
        self.customer_lat = round(lat, 6)
        self.customer_lng = round(lng, 6)
        self.customer_located_at = now

    def rate(self, stars: int, comment: str) -> None:
        self._require(RideStatus.COMPLETED)
        comment = comment.strip()
        if not 1 <= stars <= 5 or len(comment) > MAX_COMMENT:
            raise InvalidRating()
        self.rating = stars
        self.rating_comment = comment
