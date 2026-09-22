from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from neirapp.modules.ordering.domain.entities import Order, OrderLine, StoreOrder, StoreOrderStatus


class OrderItemRequest(BaseModel):
    store_id: UUID
    product_id: UUID
    quantity: int = Field(gt=0, le=20)


class CreateOrderRequest(BaseModel):
    delivery_lat: float = Field(ge=-90, le=90)
    delivery_lng: float = Field(ge=-180, le=180)
    delivery_notes: str = Field(default="", max_length=500)
    items: list[OrderItemRequest] = Field(min_length=1)


class OrderLineResponse(BaseModel):
    product_id: UUID
    name: str
    price_cop: int
    quantity: int
    subtotal_cop: int

    @classmethod
    def from_domain(cls, line: OrderLine) -> "OrderLineResponse":
        return cls(
            product_id=line.product_id,
            name=line.name,
            price_cop=line.price_cop,
            quantity=line.quantity,
            subtotal_cop=line.subtotal_cop,
        )


class StoreOrderResponse(BaseModel):
    id: UUID
    order_id: UUID
    store_id: UUID
    store_name: str
    status: StoreOrderStatus
    lines: list[OrderLineResponse]
    subtotal_cop: int
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_domain(cls, store_order: StoreOrder) -> "StoreOrderResponse":
        return cls(
            id=store_order.id,
            order_id=store_order.order_id,
            store_id=store_order.store_id,
            store_name=store_order.store_name,
            status=store_order.status,
            lines=[OrderLineResponse.from_domain(line) for line in store_order.lines],
            subtotal_cop=store_order.subtotal_cop,
            created_at=store_order.created_at,
            updated_at=store_order.updated_at,
        )


class OrderResponse(BaseModel):
    id: UUID
    customer_id: UUID
    delivery_lat: float
    delivery_lng: float
    delivery_notes: str
    total_cop: int
    created_at: datetime
    store_orders: list[StoreOrderResponse]

    @classmethod
    def from_domain(cls, order: Order) -> "OrderResponse":
        return cls(
            id=order.id,
            customer_id=order.customer_id,
            delivery_lat=order.delivery_lat,
            delivery_lng=order.delivery_lng,
            delivery_notes=order.delivery_notes,
            total_cop=order.total_cop,
            created_at=order.created_at,
            store_orders=[StoreOrderResponse.from_domain(so) for so in order.store_orders],
        )
