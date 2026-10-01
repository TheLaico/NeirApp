from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from uuid import UUID, uuid4

from neirapp.modules.dispatch.domain.codes import generate_code
from neirapp.modules.dispatch.domain.errors import (
    CannotCancelAfterPickup,
    DeliveryAlreadyFinished,
    DeliveryNotRateable,
    InvalidCourierRating,
    InvalidDeliveryCode,
    InvalidLocation,
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
    MOTOCARRO = "motocarro"


# Vehículos habilitados mientras un admin no configure otra cosa: por ahora solo motos.
DEFAULT_ENABLED_VEHICLES = frozenset({VehicleType.MOTORCYCLE})


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
    # Lo que ganan el repartidor y la plataforma por el envío de este pedido (congelado al tomarlo).
    courier_earnings_cop: int = 0
    platform_earnings_cop: int = 0

    @classmethod
    def claim(
        cls,
        *,
        order_id: UUID,
        courier_id: UUID,
        stops: list[tuple[UUID, UUID, str, UUID, float, float]],
        delivery_lat: float,
        delivery_lng: float,
        courier_earnings_cop: int = 0,
        platform_earnings_cop: int = 0,
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
            courier_earnings_cop=courier_earnings_cop,
            platform_earnings_cop=platform_earnings_cop,
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
        # Con algo ya recogido, cancelar dejaría la mercancía en manos del repartidor sin entrega.
        if any(stop.is_picked_up for stop in self.stops):
            raise CannotCancelAfterPickup()
        self.status = DeliveryStatus.CANCELLED
        self.updated_at = now


MAX_RATING_COMMENT_LENGTH = 500


@dataclass(frozen=True)
class CourierRating:
    """Calificación privada que el cliente le da al repartidor de un pedido entregado.
    Nunca se muestra al público ni al propio repartidor: solo la ve el administrador."""

    id: UUID
    delivery_id: UUID
    order_id: UUID
    courier_id: UUID
    customer_id: UUID
    rating: int
    comment: str | None
    created_at: datetime

    @classmethod
    def create(
        cls,
        *,
        delivery: "Delivery",
        customer_id: UUID,
        rating: int,
        comment: str | None,
        now: datetime,
    ) -> "CourierRating":
        if delivery.status != DeliveryStatus.DELIVERED:
            raise DeliveryNotRateable()
        if not 1 <= rating <= 5:
            raise InvalidCourierRating()
        text = " ".join(comment.split())[:MAX_RATING_COMMENT_LENGTH] if comment else ""
        return cls(
            id=uuid4(),
            delivery_id=delivery.id,
            order_id=delivery.order_id,
            courier_id=delivery.courier_id,
            customer_id=customer_id,
            rating=rating,
            comment=text or None,
            created_at=now,
        )


@dataclass(frozen=True)
class CourierLocation:
    """Última posición conocida de un repartidor (solo se guarda la más reciente)."""

    courier_id: UUID  # id del usuario en `identity`
    lat: float
    lng: float
    heading: float | None
    updated_at: datetime

    @classmethod
    def create(
        cls, *, courier_id: UUID, lat: float, lng: float, heading: float | None, now: datetime
    ) -> "CourierLocation":
        if not (-90 <= lat <= 90 and -180 <= lng <= 180):
            raise InvalidLocation()
        if heading is not None and not 0 <= heading <= 360:
            heading = None  # un rumbo raro no invalida la posición: se ignora
        return cls(courier_id=courier_id, lat=lat, lng=lng, heading=heading, updated_at=now)
