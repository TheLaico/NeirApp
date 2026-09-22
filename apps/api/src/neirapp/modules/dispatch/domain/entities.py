from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from uuid import UUID, uuid4

from neirapp.modules.dispatch.domain.codes import generate_code
from neirapp.modules.dispatch.domain.errors import (
    DeliveryAlreadyFinished,
    InvalidDeliveryCode,
    InvalidPickupCode,
    InvalidPlate,
    NotAllStopsPickedUp,
    PickupAlreadyConfirmed,
    StopNotFound,
)


class VehicleType(StrEnum):
    BIKE = "bike"
    MOTORCYCLE = "motorcycle"
    CAR = "car"


@dataclass
class CourierProfile:
    id: UUID
    user_id: UUID
    vehicle_type: VehicleType
    plate: str | None
    id_document_number: str
    is_verified: bool
    created_at: datetime

    @classmethod
    def create(
        cls,
        *,
        user_id: UUID,
        vehicle_type: VehicleType,
        plate: str | None,
        id_document_number: str,
        now: datetime,
    ) -> "CourierProfile":
        normalized_plate = _normalize_plate(plate, vehicle_type)
        return cls(
            id=uuid4(),
            user_id=user_id,
            vehicle_type=vehicle_type,
            plate=normalized_plate,
            id_document_number=id_document_number.strip(),
            # Un admin debe verificar los documentos antes de que pueda tomar entregas.
            is_verified=False,
            created_at=now,
        )

    def set_verified(self, is_verified: bool) -> None:
        self.is_verified = is_verified

    def is_owned_by(self, user_id: UUID) -> bool:
        return self.user_id == user_id


def _normalize_plate(plate: str | None, vehicle_type: VehicleType) -> str | None:
    if plate is None or not plate.strip():
        if vehicle_type != VehicleType.BIKE:
            raise InvalidPlate()
        return None
    normalized = plate.strip().upper().replace(" ", "")
    if not 5 <= len(normalized) <= 8:
        raise InvalidPlate()
    return normalized


class DeliveryStatus(StrEnum):
    ASSIGNED = "assigned"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"


@dataclass
class DeliveryStop:
    """Una recogida en una tienda. El código lo genera `ClaimDelivery`; la tienda lo recibe del
    repartidor en persona y lo confirma desde su propio panel (ver `ConfirmPickup`)."""

    store_order_id: UUID
    store_id: UUID
    store_name: str
    store_owner_user_id: UUID
    lat: float
    lng: float
    pickup_code: str
    picked_up_at: datetime | None = None

    @property
    def is_picked_up(self) -> bool:
        return self.picked_up_at is not None


@dataclass
class Delivery:
    id: UUID
    order_id: UUID
    courier_id: UUID
    status: DeliveryStatus
    stops: list[DeliveryStop]
    delivery_lat: float
    delivery_lng: float
    delivery_code: str
    created_at: datetime
    updated_at: datetime
    delivered_at: datetime | None = None

    @classmethod
    def claim(
        cls,
        *,
        order_id: UUID,
        courier_id: UUID,
        stops: list[tuple[UUID, UUID, str, UUID, float, float]],
        delivery_lat: float,
        delivery_lng: float,
        now: datetime,
    ) -> "Delivery":
        """`stops`: (store_order_id, store_id, store_name, store_owner_user_id, lat, lng)."""
        return cls(
            id=uuid4(),
            order_id=order_id,
            courier_id=courier_id,
            status=DeliveryStatus.ASSIGNED,
            stops=[
                DeliveryStop(
                    store_order_id=store_order_id,
                    store_id=store_id,
                    store_name=store_name,
                    store_owner_user_id=store_owner_user_id,
                    lat=lat,
                    lng=lng,
                    pickup_code=generate_code(),
                )
                for store_order_id, store_id, store_name, store_owner_user_id, lat, lng in stops
            ],
            delivery_lat=delivery_lat,
            delivery_lng=delivery_lng,
            delivery_code=generate_code(),
            created_at=now,
            updated_at=now,
        )

    @property
    def all_stops_picked_up(self) -> bool:
        return all(stop.is_picked_up for stop in self.stops)

    def is_owned_by_courier(self, user_id: UUID) -> bool:
        return self.courier_id == user_id

    def _find_stop(self, store_id: UUID) -> DeliveryStop:
        for stop in self.stops:
            if stop.store_id == store_id:
                return stop
        raise StopNotFound()

    def confirm_pickup(self, store_id: UUID, code: str, now: datetime) -> DeliveryStop:
        if self.status != DeliveryStatus.ASSIGNED:
            raise DeliveryAlreadyFinished()
        stop = self._find_stop(store_id)
        if stop.is_picked_up:
            raise PickupAlreadyConfirmed()
        if stop.pickup_code != code.strip().upper():
            raise InvalidPickupCode()
        stop.picked_up_at = now
        self.updated_at = now
        return stop

    def confirm_delivery(self, code: str, now: datetime) -> None:
        if self.status != DeliveryStatus.ASSIGNED:
            raise DeliveryAlreadyFinished()
        if not self.all_stops_picked_up:
            raise NotAllStopsPickedUp()
        if self.delivery_code != code.strip().upper():
            raise InvalidDeliveryCode()
        self.status = DeliveryStatus.DELIVERED
        self.delivered_at = now
        self.updated_at = now

    def cancel(self, now: datetime) -> None:
        if self.status != DeliveryStatus.ASSIGNED:
            raise DeliveryAlreadyFinished()
        self.status = DeliveryStatus.CANCELLED
        self.updated_at = now
