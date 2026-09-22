from collections.abc import Callable
from types import TracebackType
from typing import Protocol, Self
from uuid import UUID

from neirapp.modules.ordering.application.dto import ProductSnapshot, StoreOrderView, StoreSnapshot
from neirapp.modules.ordering.domain.entities import Order, StoreOrder, StoreOrderStatus


class CatalogPort(Protocol):
    """Capa anticorrupción hacia el módulo `stores`: `ordering` nunca importa sus entidades ni
    sus repos, solo estos snapshots de solo lectura. El adaptador real vive en
    `infrastructure/catalog_adapter.py` y en `bootstrap` se conecta a la app de `stores`."""

    async def get_store(self, store_id: UUID) -> StoreSnapshot | None: ...

    async def get_product(self, store_id: UUID, product_id: UUID) -> ProductSnapshot | None: ...


class PaymentGateway(Protocol):
    """Puerto de pago. `infrastructure/fake_payment_gateway.py` es el adaptador de desarrollo;
    una pasarela real (Wompi, ePayco...) implementa el mismo puerto sin tocar los casos de uso."""

    async def charge(self, order_id: UUID, amount_cop: int) -> bool: ...


class StoreNotifier(Protocol):
    """Avisa a un comercio (por WebSocket) que le llegó un pedido nuevo. Ver
    `infrastructure/ws_manager.py`: en un solo proceso no hace falta Redis; para varias
    instancias en producción, este puerto se reimplementa con pub/sub (ver docs/ARCHITECTURE.md)."""

    async def notify_new_order(self, store_id: UUID, store_order_id: UUID) -> None: ...


class OrderRepository(Protocol):
    async def add(self, order: Order) -> None: ...

    async def get(self, order_id: UUID) -> Order | None: ...

    async def list_by_customer(self, customer_id: UUID) -> list[Order]: ...

    async def get_store_order(self, store_order_id: UUID) -> StoreOrderView | None: ...

    async def list_by_store(
        self, store_id: UUID, *, status: StoreOrderStatus | None = None
    ) -> list[StoreOrderView]: ...

    async def update_store_order(self, store_order: StoreOrder) -> None: ...


class UnitOfWork(Protocol):
    @property
    def orders(self) -> OrderRepository: ...

    async def __aenter__(self) -> Self: ...

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        tb: TracebackType | None,
    ) -> None: ...

    async def commit(self) -> None: ...

    async def rollback(self) -> None: ...


UnitOfWorkFactory = Callable[[], UnitOfWork]
