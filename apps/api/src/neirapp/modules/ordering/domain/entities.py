from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum
from uuid import UUID, uuid4

from neirapp.modules.ordering.domain.errors import (
    EmptyOrder,
    InvalidRejectionReason,
    InvalidStoreOrderTransition,
    OutsideServiceArea,
)
from neirapp.modules.ordering.domain.geofence import is_within_neira

MIN_REJECTION_REASON = 3
MAX_REJECTION_REASON = 300


class StoreOrderStatus(StrEnum):
    """Máquina de estados del pedido de una tienda dentro de un `Order`.

    `HANDED_OVER` (Fase 3): el comercio confirmó el código del repartidor que lo recogió. Quién
    dispara esa transición vive en el módulo `dispatch` (ver `MarkStoreOrderHandedOverRaw`), no
    aquí — `ordering` solo expone el estado y la transición en sí.
    """

    PENDING_PAYMENT = "pending_payment"
    PAID = "paid"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    PREPARING = "preparing"
    READY = "ready"
    HANDED_OVER = "handed_over"


# Transiciones válidas: origen -> destinos permitidos. Cualquier otro salto es un bug del llamador
# (intentar aceptar un pedido no pagado, marcar listo uno rechazado, etc.) y se rechaza explícito.
_TRANSITIONS: dict[StoreOrderStatus, frozenset[StoreOrderStatus]] = {
    StoreOrderStatus.PENDING_PAYMENT: frozenset({StoreOrderStatus.PAID}),
    StoreOrderStatus.PAID: frozenset({StoreOrderStatus.ACCEPTED, StoreOrderStatus.REJECTED}),
    StoreOrderStatus.ACCEPTED: frozenset({StoreOrderStatus.PREPARING}),
    StoreOrderStatus.PREPARING: frozenset({StoreOrderStatus.READY}),
    StoreOrderStatus.READY: frozenset({StoreOrderStatus.HANDED_OVER}),
    StoreOrderStatus.REJECTED: frozenset(),
    StoreOrderStatus.HANDED_OVER: frozenset(),
}


@dataclass(frozen=True)
class OrderLine:
    """Copia (`snapshot`) del producto al momento de pedir: el precio no cambia si la tienda
    edita su catálogo después. `product_id` queda solo como referencia, no para releer datos."""

    product_id: UUID
    name: str
    price_cop: int
    quantity: int

    @property
    def subtotal_cop(self) -> int:
        return self.price_cop * self.quantity


@dataclass
class StoreOrder:
    id: UUID
    order_id: UUID
    store_id: UUID
    store_name: str
    # Dueño de la tienda al momento del pedido: autoriza las acciones del comercio sin tener que
    # volver a consultar el módulo `stores` en cada una (ver CatalogPort en application/ports.py).
    store_owner_user_id: UUID
    status: StoreOrderStatus
    lines: list[OrderLine]
    created_at: datetime
    updated_at: datetime
    # Justificación del comercio cuando rechaza el pedido; el cliente la ve para saber por qué.
    rejection_reason: str | None = None

    @property
    def subtotal_cop(self) -> int:
        return sum(line.subtotal_cop for line in self.lines)

    def _transition(self, target: StoreOrderStatus, now: datetime) -> None:
        if target not in _TRANSITIONS[self.status]:
            raise InvalidStoreOrderTransition(
                f"No se puede pasar de '{self.status.value}' a '{target.value}'."
            )
        self.status = target
        self.updated_at = now

    def mark_paid(self, now: datetime) -> None:
        self._transition(StoreOrderStatus.PAID, now)

    def accept(self, now: datetime) -> None:
        self._transition(StoreOrderStatus.ACCEPTED, now)

    def reject(self, reason: str, now: datetime) -> None:
        reason = " ".join(reason.split())
        if not MIN_REJECTION_REASON <= len(reason) <= MAX_REJECTION_REASON:
            raise InvalidRejectionReason()
        self._transition(StoreOrderStatus.REJECTED, now)
        self.rejection_reason = reason

    def start_preparing(self, now: datetime) -> None:
        self._transition(StoreOrderStatus.PREPARING, now)

    def mark_ready(self, now: datetime) -> None:
        self._transition(StoreOrderStatus.READY, now)

    def mark_handed_over(self, now: datetime) -> None:
        self._transition(StoreOrderStatus.HANDED_OVER, now)

    def is_owned_by_store(self, user_id: UUID) -> bool:
        return self.store_owner_user_id == user_id


@dataclass
class Order:
    id: UUID
    customer_id: UUID
    delivery_lat: float
    delivery_lng: float
    delivery_notes: str
    created_at: datetime
    store_orders: list[StoreOrder] = field(default_factory=list)
    # Envío que se cobró y la parte que se lleva el repartidor, tal como estaban al crear el pedido.
    delivery_fee_cop: int = 0
    courier_earnings_cop: int = 0

    @property
    def products_cop(self) -> int:
        return sum(so.subtotal_cop for so in self.store_orders)

    @property
    def platform_earnings_cop(self) -> int:
        return self.delivery_fee_cop - self.courier_earnings_cop

    @property
    def total_cop(self) -> int:
        return self.products_cop + self.delivery_fee_cop

    def is_owned_by(self, user_id: UUID) -> bool:
        return self.customer_id == user_id

    @classmethod
    def create_empty(
        cls,
        *,
        customer_id: UUID,
        delivery_lat: float,
        delivery_lng: float,
        delivery_notes: str,
        delivery_fee_cop: int = 0,
        courier_earnings_cop: int = 0,
        now: datetime,
    ) -> "Order":
        if not is_within_neira(delivery_lat, delivery_lng):
            raise OutsideServiceArea()
        return cls(
            id=uuid4(),
            customer_id=customer_id,
            delivery_lat=delivery_lat,
            delivery_lng=delivery_lng,
            delivery_notes=delivery_notes.strip()[:500],
            created_at=now,
            delivery_fee_cop=delivery_fee_cop,
            courier_earnings_cop=courier_earnings_cop,
        )

    def add_store_order(
        self, *, store_id: UUID, store_name: str, store_owner_user_id: UUID, lines: list[OrderLine]
    ) -> StoreOrder:
        if not lines:
            raise EmptyOrder()
        store_order = StoreOrder(
            id=uuid4(),
            order_id=self.id,
            store_id=store_id,
            store_name=store_name,
            store_owner_user_id=store_owner_user_id,
            status=StoreOrderStatus.PENDING_PAYMENT,
            lines=lines,
            created_at=self.created_at,
            updated_at=self.created_at,
        )
        self.store_orders.append(store_order)
        return store_order
