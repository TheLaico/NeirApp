from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from neirapp.modules.dispatch.application.dto import ClaimableOrderSnapshot, ClaimableStopSnapshot
from neirapp.modules.dispatch.domain.entities import (
    CourierProfile,
    Delivery,
    DeliveryStatus,
    DeliveryStop,
    VehicleType,
)


class CreateCourierProfileRequest(BaseModel):
    vehicle_type: VehicleType
    plate: str | None = Field(default=None, max_length=16)
    id_document_number: str = Field(min_length=4, max_length=32)


class SetVehicleTypeEnabledRequest(BaseModel):
    is_enabled: bool


class VehicleTypeResponse(BaseModel):
    vehicle_type: VehicleType
    is_enabled: bool

    @classmethod
    def from_map(cls, enabled: dict[VehicleType, bool]) -> "list[VehicleTypeResponse]":
        return [cls(vehicle_type=v, is_enabled=on) for v, on in enabled.items()]


class SetCourierVerificationRequest(BaseModel):
    is_verified: bool


class CourierProfileResponse(BaseModel):
    id: UUID
    user_id: UUID
    vehicle_type: VehicleType
    plate: str | None
    id_document_number: str
    is_verified: bool

    @classmethod
    def from_domain(cls, profile: CourierProfile) -> "CourierProfileResponse":
        return cls(
            id=profile.id,
            user_id=profile.user_id,
            vehicle_type=profile.vehicle_type,
            plate=profile.plate,
            id_document_number=profile.id_document_number,
            is_verified=profile.is_verified,
        )


class ClaimableStopResponse(BaseModel):
    store_order_id: UUID
    store_id: UUID
    store_name: str
    status: str

    @classmethod
    def from_domain(cls, stop: ClaimableStopSnapshot) -> "ClaimableStopResponse":
        return cls(
            store_order_id=stop.store_order_id,
            store_id=stop.store_id,
            store_name=stop.store_name,
            status=stop.status,
        )


class ClaimableOrderResponse(BaseModel):
    order_id: UUID
    delivery_lat: float
    delivery_lng: float
    delivery_notes: str
    delivery_fee_cop: int
    courier_earnings_cop: int
    stops: list[ClaimableStopResponse]

    @classmethod
    def from_domain(cls, order: ClaimableOrderSnapshot) -> "ClaimableOrderResponse":
        return cls(
            order_id=order.order_id,
            delivery_lat=order.delivery_lat,
            delivery_lng=order.delivery_lng,
            delivery_notes=order.delivery_notes,
            delivery_fee_cop=order.delivery_fee_cop,
            courier_earnings_cop=order.courier_earnings_cop,
            stops=[ClaimableStopResponse.from_domain(s) for s in order.stops],
        )


class DeliveryStopResponse(BaseModel):
    store_order_id: UUID
    store_id: UUID
    store_name: str
    lat: float
    lng: float
    pickup_code: str
    is_picked_up: bool
    picked_up_at: datetime | None
    is_ready: bool = False

    @classmethod
    def from_domain(cls, stop: DeliveryStop, is_ready: bool = False) -> "DeliveryStopResponse":
        return cls(
            store_order_id=stop.store_order_id,
            store_id=stop.store_id,
            store_name=stop.store_name,
            lat=stop.lat,
            lng=stop.lng,
            pickup_code=stop.pickup_code,
            is_picked_up=stop.is_picked_up,
            picked_up_at=stop.picked_up_at,
            is_ready=is_ready,
        )


class DeliveryResponse(BaseModel):
    """No incluye `delivery_code`: ese código lo tiene el cliente, no el repartidor — ver
    `CustomerDeliveryResponse` para la vista del cliente."""

    id: UUID
    order_id: UUID
    status: DeliveryStatus
    stops: list[DeliveryStopResponse]
    suggested_stop_order: list[UUID]
    delivery_lat: float
    delivery_lng: float
    all_stops_picked_up: bool
    courier_earnings_cop: int
    # Contacto del cliente: solo se llena en la entrega activa del propio repartidor.
    customer_name: str | None = None
    customer_phone: str | None = None
    created_at: datetime
    updated_at: datetime
    delivered_at: datetime | None

    @classmethod
    def from_domain(
        cls,
        delivery: Delivery,
        suggested_stop_order: list[UUID],
        ready_ids: set[UUID] | None = None,
    ) -> "DeliveryResponse":
        ready = ready_ids or set()
        return cls(
            id=delivery.id,
            order_id=delivery.order_id,
            status=delivery.status,
            stops=[
                DeliveryStopResponse.from_domain(s, s.store_order_id in ready)
                for s in delivery.stops
            ],
            suggested_stop_order=suggested_stop_order,
            delivery_lat=delivery.delivery_lat,
            delivery_lng=delivery.delivery_lng,
            all_stops_picked_up=delivery.all_stops_picked_up,
            courier_earnings_cop=delivery.courier_earnings_cop,
            created_at=delivery.created_at,
            updated_at=delivery.updated_at,
            delivered_at=delivery.delivered_at,
        )


class UpdateLocationRequest(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    heading: float | None = Field(default=None, ge=0, le=360)


class LiveStopResponse(BaseModel):
    store_name: str
    lat: float
    lng: float
    is_picked_up: bool


class LiveCourierResponse(BaseModel):
    """Solo para el administrador: dónde está cada repartidor y qué está haciendo."""

    courier_id: UUID
    name: str
    email: str
    vehicle_type: VehicleType
    plate: str | None
    lat: float
    lng: float
    heading: float | None
    updated_at: datetime
    is_online: bool
    active_order_id: UUID | None
    stops_picked_up: int
    stops_total: int
    stops: list[LiveStopResponse]
    delivery_lat: float | None
    delivery_lng: float | None


class EarningsSummaryResponse(BaseModel):
    deliveries: int
    courier_cop: int
    platform_cop: int


class MyCourierRatingResponse(BaseModel):
    rating: int
    comment: str | None


class RateCourierRequest(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: str | None = Field(default=None, max_length=1000)


class CourierRatingAdminResponse(BaseModel):
    """Solo para el administrador: quién calificó a qué repartidor y con cuánto."""

    id: UUID
    order_id: UUID
    courier_id: UUID
    courier_name: str
    courier_email: str
    rating: int
    comment: str | None
    created_at: datetime


class CustomerDeliveryResponse(BaseModel):
    """Lo que ve el cliente: el código que le tiene que dar al repartidor, y cuántas paradas
    faltan — nunca los códigos de recogida de las tiendas (esos son entre el repartidor y ellas)."""

    status: DeliveryStatus
    delivery_code: str
    stops_picked_up: int
    stops_total: int
    my_rating: "MyCourierRatingResponse | None" = None

    @classmethod
    def from_domain(cls, delivery: Delivery) -> "CustomerDeliveryResponse":
        return cls(
            status=delivery.status,
            delivery_code=delivery.delivery_code,
            stops_picked_up=sum(1 for s in delivery.stops if s.is_picked_up),
            stops_total=len(delivery.stops),
        )


class ConfirmPickupRequest(BaseModel):
    code: str = Field(min_length=1, max_length=16)


class ConfirmDeliveryRequest(BaseModel):
    code: str = Field(min_length=1, max_length=16)
