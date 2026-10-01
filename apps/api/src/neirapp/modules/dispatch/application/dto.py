from dataclasses import dataclass
from uuid import UUID


@dataclass(frozen=True)
class StoreLocationSnapshot:
    """Lo que `dispatch` necesita saber de una tienda, sin importar el módulo `stores`."""

    id: UUID
    name: str
    lat: float
    lng: float
    owner_user_id: UUID


@dataclass(frozen=True)
class EarningsSummary:
    """Lo que dejaron las entregas completadas: cuántas, y lo de repartidores y plataforma."""

    deliveries: int
    courier_cop: int
    platform_cop: int


@dataclass(frozen=True)
class ClaimableStopSnapshot:
    store_order_id: UUID
    store_id: UUID
    store_name: str
    status: str  # espejo de StoreOrderStatus de `ordering`, como texto (ver CatalogPort)


@dataclass(frozen=True)
class ClaimableOrderSnapshot:
    """Un pedido que un repartidor podría tomar, sin importar las entidades de `ordering`."""

    order_id: UUID
    customer_id: UUID
    delivery_lat: float
    delivery_lng: float
    delivery_notes: str
    stops: list[ClaimableStopSnapshot]
    delivery_fee_cop: int = 0
    courier_earnings_cop: int = 0
