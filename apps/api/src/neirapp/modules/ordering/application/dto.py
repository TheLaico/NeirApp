from dataclasses import dataclass
from uuid import UUID

from neirapp.modules.ordering.domain.entities import StoreOrder


@dataclass(frozen=True)
class StoreSnapshot:
    """Lo que `ordering` necesita saber de una tienda, sin importar el módulo `stores`."""

    id: UUID
    name: str
    owner_user_id: UUID
    is_open: bool
    is_approved: bool


@dataclass(frozen=True)
class DeliveryFeeSnapshot:
    """Tarifa de envío vigente: se guarda en cada pedido al crearse."""

    delivery_fee_cop: int
    courier_earnings_cop: int


@dataclass(frozen=True)
class ProductSnapshot:
    id: UUID
    name: str
    price_cop: int
    is_available: bool


@dataclass(frozen=True)
class StoreOrderView:
    """Un `StoreOrder` junto con el id del `Order` al que pertenece y su dueño (el cliente).

    El repositorio lo arma en una sola consulta: evita que el caso de uso tenga que ir a buscar
    el `Order` completo solo para saber de quién es, en flujos que operan sobre un StoreOrder.
    """

    store_order: StoreOrder
    order_id: UUID
    customer_id: UUID
