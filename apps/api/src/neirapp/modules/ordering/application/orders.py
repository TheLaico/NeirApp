from collections import defaultdict
from dataclasses import dataclass
from uuid import UUID

from neirapp.modules.ordering.application.dto import StoreOrderView
from neirapp.modules.ordering.application.ports import (
    CatalogPort,
    PaymentGateway,
    StoreNotifier,
    UnitOfWorkFactory,
)
from neirapp.modules.ordering.domain.entities import Order, OrderLine, StoreOrder, StoreOrderStatus
from neirapp.modules.ordering.domain.errors import (
    EmptyOrder,
    InvalidQuantity,
    NotOrderOwner,
    NotStoreOrderOwner,
    OrderAlreadyPaid,
    OrderNotFound,
    PaymentFailed,
    ProductUnavailableForOrder,
    StoreOrderNotFound,
    StoreUnavailableForOrder,
)
from neirapp.shared.application.ports import Clock


@dataclass(frozen=True)
class OrderItemCommand:
    store_id: UUID
    product_id: UUID
    quantity: int


@dataclass(frozen=True)
class CreateOrderCommand:
    delivery_lat: float
    delivery_lng: float
    delivery_notes: str
    items: list[OrderItemCommand]


class CreateOrder:
    """Arma el pedido a partir del carrito. El precio y la disponibilidad se leen SIEMPRE del
    catálogo en este instante — nunca se confía en un precio que mande el cliente."""

    def __init__(self, uow_factory: UnitOfWorkFactory, catalog: CatalogPort, clock: Clock) -> None:
        self._uow_factory = uow_factory
        self._catalog = catalog
        self._clock = clock

    async def __call__(self, customer_id: UUID, cmd: CreateOrderCommand) -> Order:
        if not cmd.items:
            raise EmptyOrder()

        by_store: dict[UUID, list[OrderItemCommand]] = defaultdict(list)
        for item in cmd.items:
            if item.quantity <= 0:
                raise InvalidQuantity()
            by_store[item.store_id].append(item)

        now = self._clock.now()
        order = Order.create_empty(
            customer_id=customer_id,
            delivery_lat=cmd.delivery_lat,
            delivery_lng=cmd.delivery_lng,
            delivery_notes=cmd.delivery_notes,
            now=now,
        )

        for store_id, items in by_store.items():
            store = await self._catalog.get_store(store_id)
            if store is None or not store.is_approved or not store.is_open:
                raise StoreUnavailableForOrder()

            lines: list[OrderLine] = []
            for item in items:
                product = await self._catalog.get_product(store_id, item.product_id)
                if product is None or not product.is_available:
                    raise ProductUnavailableForOrder()
                lines.append(
                    OrderLine(
                        product_id=product.id,
                        name=product.name,
                        price_cop=product.price_cop,
                        quantity=item.quantity,
                    )
                )
            order.add_store_order(
                store_id=store.id,
                store_name=store.name,
                store_owner_user_id=store.owner_user_id,
                lines=lines,
            )

        async with self._uow_factory() as uow:
            await uow.orders.add(order)
            await uow.commit()
        return order


class GetOrder:
    def __init__(self, uow_factory: UnitOfWorkFactory) -> None:
        self._uow_factory = uow_factory

    async def __call__(self, order_id: UUID, customer_id: UUID) -> Order:
        async with self._uow_factory() as uow:
            order = await uow.orders.get(order_id)
        if order is None:
            raise OrderNotFound()
        if not order.is_owned_by(customer_id):
            raise NotOrderOwner()
        return order


class ListMyOrders:
    def __init__(self, uow_factory: UnitOfWorkFactory) -> None:
        self._uow_factory = uow_factory

    async def __call__(self, customer_id: UUID) -> list[Order]:
        async with self._uow_factory() as uow:
            return await uow.orders.list_by_customer(customer_id)


class GetOrderRaw:
    """Lectura interna sin verificar dueño, para el `OrderingPort` de `dispatch` (mismo patrón que
    `GetStoreRaw`/`GetProductRaw` en `stores`). Nunca se expone por HTTP."""

    def __init__(self, uow_factory: UnitOfWorkFactory) -> None:
        self._uow_factory = uow_factory

    async def __call__(self, order_id: UUID) -> Order | None:
        async with self._uow_factory() as uow:
            return await uow.orders.get(order_id)


class GetStoreOrderViewRaw:
    """Lectura interna de un `StoreOrder` con su `order_id`/`customer_id`, para el `OrderingPort`
    de `reviews` (necesita saber quién puede calificarlo y si ya se completó). Nunca se expone
    por HTTP directamente — `reviews` decide qué autorizar con este dato."""

    def __init__(self, uow_factory: UnitOfWorkFactory) -> None:
        self._uow_factory = uow_factory

    async def __call__(self, store_order_id: UUID) -> StoreOrderView | None:
        async with self._uow_factory() as uow:
            return await uow.orders.get_store_order(store_order_id)


class ListClaimableOrders:
    """Pedidos que un repartidor podría ofrecerse a llevar (ver `OrderRepository.list_claimable`).
    Interna, para `dispatch` — la decisión de si ya tienen repartidor asignado no la sabe
    `ordering`, así que esta lista puede incluir pedidos que `dispatch` ya filtre por su cuenta."""

    def __init__(self, uow_factory: UnitOfWorkFactory) -> None:
        self._uow_factory = uow_factory

    async def __call__(self) -> list[Order]:
        async with self._uow_factory() as uow:
            return await uow.orders.list_claimable()


class MarkStoreOrderHandedOverRaw:
    """Transiciona un `StoreOrder` a `HANDED_OVER`. La autorización (¿es esta persona la dueña de
    la tienda?) ya la hizo `dispatch` con su propio `StoresPort` antes de llamar aquí — este caso
    de uso no vuelve a verificarla, y por eso nunca se expone por HTTP directamente."""

    def __init__(self, uow_factory: UnitOfWorkFactory, clock: Clock) -> None:
        self._uow_factory = uow_factory
        self._clock = clock

    async def __call__(self, store_order_id: UUID) -> StoreOrder:
        async with self._uow_factory() as uow:
            view = await uow.orders.get_store_order(store_order_id)
            if view is None:
                raise StoreOrderNotFound()
            store_order = view.store_order
            store_order.mark_handed_over(self._clock.now())
            await uow.orders.update_store_order(store_order)
            await uow.commit()
        return store_order


class PayOrder:
    """Cobra el pedido completo de una vez (un solo cargo cubre varias tiendas). Si la pasarela
    lo aprueba, cada `StoreOrder` pasa a `PAID` y su tienda recibe una notificación en vivo.

    La dispersión del dinero a cada tienda (descontando comisión) es la Fase 3 (`wallet`); aquí
    solo se confirma el cobro, no se reparte nada todavía.
    """

    def __init__(
        self,
        uow_factory: UnitOfWorkFactory,
        gateway: PaymentGateway,
        notifier: StoreNotifier,
        clock: Clock,
    ) -> None:
        self._uow_factory = uow_factory
        self._gateway = gateway
        self._notifier = notifier
        self._clock = clock

    async def __call__(self, order_id: UUID, customer_id: UUID) -> Order:
        async with self._uow_factory() as uow:
            order = await uow.orders.get(order_id)
            if order is None:
                raise OrderNotFound()
            if not order.is_owned_by(customer_id):
                raise NotOrderOwner()

            pending = [
                so for so in order.store_orders if so.status == StoreOrderStatus.PENDING_PAYMENT
            ]
            if not pending:
                raise OrderAlreadyPaid()

            if not await self._gateway.charge(order.id, order.total_cop):
                raise PaymentFailed()

            now = self._clock.now()
            for store_order in pending:
                store_order.mark_paid(now)
                await uow.orders.update_store_order(store_order)
            await uow.commit()

        for store_order in pending:
            await self._notifier.notify_new_order(store_order.store_id, store_order.id)
        return order


async def _load_owned_store_order(
    uow_factory: UnitOfWorkFactory, store_order_id: UUID, user_id: UUID
) -> StoreOrder:
    async with uow_factory() as uow:
        view = await uow.orders.get_store_order(store_order_id)
        if view is None:
            raise StoreOrderNotFound()
        if not view.store_order.is_owned_by_store(user_id):
            raise NotStoreOrderOwner()
        return view.store_order


class ListStoreOrders:
    """Vista del comercio: sus pedidos, opcionalmente filtrados por estado (p. ej. `paid` para
    "pedidos nuevos por aceptar"). Verifica la propiedad vía `CatalogPort` porque una tienda sin
    pedidos todavía no tiene ningún `StoreOrder` del cual leer el dueño."""

    def __init__(self, uow_factory: UnitOfWorkFactory, catalog: CatalogPort) -> None:
        self._uow_factory = uow_factory
        self._catalog = catalog

    async def __call__(
        self, store_id: UUID, user_id: UUID, *, status: StoreOrderStatus | None = None
    ) -> list[StoreOrderView]:
        store = await self._catalog.get_store(store_id)
        if store is None or store.owner_user_id != user_id:
            raise NotStoreOrderOwner()
        async with self._uow_factory() as uow:
            return await uow.orders.list_by_store(store_id, status=status)


class AcceptStoreOrder:
    def __init__(self, uow_factory: UnitOfWorkFactory, clock: Clock) -> None:
        self._uow_factory = uow_factory
        self._clock = clock

    async def __call__(self, store_order_id: UUID, user_id: UUID) -> StoreOrder:
        store_order = await _load_owned_store_order(self._uow_factory, store_order_id, user_id)
        store_order.accept(self._clock.now())
        async with self._uow_factory() as uow:
            await uow.orders.update_store_order(store_order)
            await uow.commit()
        return store_order


class RejectStoreOrder:
    def __init__(self, uow_factory: UnitOfWorkFactory, clock: Clock) -> None:
        self._uow_factory = uow_factory
        self._clock = clock

    async def __call__(self, store_order_id: UUID, user_id: UUID) -> StoreOrder:
        store_order = await _load_owned_store_order(self._uow_factory, store_order_id, user_id)
        store_order.reject(self._clock.now())
        async with self._uow_factory() as uow:
            await uow.orders.update_store_order(store_order)
            await uow.commit()
        return store_order


class StartPreparingStoreOrder:
    def __init__(self, uow_factory: UnitOfWorkFactory, clock: Clock) -> None:
        self._uow_factory = uow_factory
        self._clock = clock

    async def __call__(self, store_order_id: UUID, user_id: UUID) -> StoreOrder:
        store_order = await _load_owned_store_order(self._uow_factory, store_order_id, user_id)
        store_order.start_preparing(self._clock.now())
        async with self._uow_factory() as uow:
            await uow.orders.update_store_order(store_order)
            await uow.commit()
        return store_order


class MarkStoreOrderReady:
    def __init__(self, uow_factory: UnitOfWorkFactory, clock: Clock) -> None:
        self._uow_factory = uow_factory
        self._clock = clock

    async def __call__(self, store_order_id: UUID, user_id: UUID) -> StoreOrder:
        store_order = await _load_owned_store_order(self._uow_factory, store_order_id, user_id)
        store_order.mark_ready(self._clock.now())
        async with self._uow_factory() as uow:
            await uow.orders.update_store_order(store_order)
            await uow.commit()
        return store_order
