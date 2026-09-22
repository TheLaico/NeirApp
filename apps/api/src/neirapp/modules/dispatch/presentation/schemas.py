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
    stops: list[ClaimableStopResponse]

    @classmethod
    def from_domain(cls, order: ClaimableOrderSnapshot) -> "ClaimableOrderResponse":
        return cls(
            order_id=order.order_id,
            delivery_lat=order.delivery_lat,
            delivery_lng=order.delivery_lng,
            delivery_notes=order.delivery_notes,
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

    @classmethod
    def from_domain(cls, stop: DeliveryStop) -> "DeliveryStopResponse":
        return cls(
            store_order_id=stop.store_order_id,
            store_id=stop.store_id,
            store_name=stop.store_name,
            lat=stop.lat,
            lng=stop.lng,
            pickup_code=stop.pickup_code,
            is_picked_up=stop.is_picked_up,
            picked_up_at=stop.picked_up_at,
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
    created_at: datetime
    updated_at: datetime
    delivered_at: datetime | None

    @classmethod
    def from_domain(
        cls, delivery: Delivery, suggested_stop_order: list[UUID]
    ) -> "DeliveryResponse":
        return cls(
            id=delivery.id,
            order_id=delivery.order_id,
            status=delivery.status,
            stops=[DeliveryStopResponse.from_domain(s) for s in delivery.stops],
            suggested_stop_order=suggested_stop_order,
            delivery_lat=delivery.delivery_lat,
            delivery_lng=delivery.delivery_lng,
            all_stops_picked_up=delivery.all_stops_picked_up,
            created_at=delivery.created_at,
            updated_at=delivery.updated_at,
            delivered_at=delivery.delivered_at,
        )


class CustomerDeliveryResponse(BaseModel):
    """Lo que ve el cliente: el código que le tiene que dar al repartidor, y cuántas paradas
    faltan — nunca los códigos de recogida de las tiendas (esos son entre el repartidor y ellas)."""

    status: DeliveryStatus
    delivery_code: str
    stops_picked_up: int
    stops_total: int

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
