from uuid import UUID

from neirapp.modules.dispatch.application.dto import ClaimableOrderSnapshot
from neirapp.modules.dispatch.application.ports import (
    OrderingPort,
    StoresPort,
    UnitOfWorkFactory,
    WalletPort,
)
from neirapp.modules.dispatch.domain.entities import Delivery, DeliveryStop
from neirapp.modules.dispatch.domain.errors import (
    CourierNotVerified,
    CourierProfileNotFound,
    DeliveryNotFound,
    NotDeliveryCourier,
    NotOrderCustomer,
    NotStopStoreOwner,
    OrderAlreadyClaimed,
    OrderNotClaimable,
)
from neirapp.modules.dispatch.domain.pricing import compute_earnings_cop
from neirapp.modules.dispatch.domain.routing import suggest_route
from neirapp.shared.application.ports import Clock


async def _require_verified_courier(uow_factory: UnitOfWorkFactory, user_id: UUID) -> UUID:
    """`Delivery.courier_id` guarda directamente el `user_id` de `identity` (no el id del
    `CourierProfile`): así `WalletPort.credit_courier` puede acreditarle saldo al mismo usuario
    autenticado que después consulta `GET /wallet/balance` sin tener que resolver un id aparte."""
    async with uow_factory() as uow:
        profile = await uow.couriers.get_by_user(user_id)
    if profile is None:
        raise CourierProfileNotFound()
    if not profile.is_verified:
        raise CourierNotVerified()
    return user_id


class ListAvailableDeliveries:
    def __init__(self, uow_factory: UnitOfWorkFactory, ordering: OrderingPort) -> None:
        self._uow_factory = uow_factory
        self._ordering = ordering

    async def __call__(self, user_id: UUID) -> list[ClaimableOrderSnapshot]:
        await _require_verified_courier(self._uow_factory, user_id)
        claimable = await self._ordering.list_claimable_orders()
        async with self._uow_factory() as uow:
            already_claimed = {
                order.order_id
                for order in claimable
                if await uow.deliveries.get_by_order(order.order_id) is not None
            }
        return [order for order in claimable if order.order_id not in already_claimed]


class ClaimDelivery:
    """Toma un pedido disponible. Es atómico gracias a una restricción única en `order_id` en la
    tabla de entregas: si dos repartidores lo intentan a la vez, solo uno gana y el otro recibe
    `OrderAlreadyClaimed` (ver `infrastructure/repositories.py`)."""

    def __init__(
        self,
        uow_factory: UnitOfWorkFactory,
        ordering: OrderingPort,
        stores: StoresPort,
        clock: Clock,
    ) -> None:
        self._uow_factory = uow_factory
        self._ordering = ordering
        self._stores = stores
        self._clock = clock

    async def __call__(self, order_id: UUID, user_id: UUID) -> Delivery:
        courier_id = await _require_verified_courier(self._uow_factory, user_id)

        order = await self._ordering.get_claimable_order(order_id)
        if order is None:
            raise OrderNotClaimable()

        stops: list[tuple[UUID, UUID, str, UUID, float, float]] = []
        for stop in order.stops:
            store = await self._stores.get_store(stop.store_id)
            if store is None:
                raise OrderNotClaimable()
            stops.append(
                (
                    stop.store_order_id,
                    stop.store_id,
                    stop.store_name,
                    store.owner_user_id,
                    store.lat,
                    store.lng,
                )
            )

        delivery = Delivery.claim(
            order_id=order.order_id,
            courier_id=courier_id,
            stops=stops,
            delivery_lat=order.delivery_lat,
            delivery_lng=order.delivery_lng,
            now=self._clock.now(),
        )

        async with self._uow_factory() as uow:
            if await uow.deliveries.get_by_order(order_id) is not None:
                raise OrderAlreadyClaimed()
            await uow.deliveries.add(delivery)
            await uow.commit()
        return delivery


class GetMyActiveDelivery:
    def __init__(self, uow_factory: UnitOfWorkFactory) -> None:
        self._uow_factory = uow_factory

    async def __call__(self, user_id: UUID) -> Delivery | None:
        courier_id = await _require_verified_courier(self._uow_factory, user_id)
        async with self._uow_factory() as uow:
            return await uow.deliveries.get_active_for_courier(courier_id)


class ListMyDeliveryHistory:
    def __init__(self, uow_factory: UnitOfWorkFactory) -> None:
        self._uow_factory = uow_factory

    async def __call__(self, user_id: UUID) -> list[Delivery]:
        courier_id = await _require_verified_courier(self._uow_factory, user_id)
        async with self._uow_factory() as uow:
            return await uow.deliveries.list_by_courier(courier_id)


def suggested_stop_order(delivery: Delivery) -> list[UUID]:
    """Ids de `store_order_id` en el orden sugerido de visita (paradas sin recoger primero)."""
    pending = [s for s in delivery.stops if not s.is_picked_up]
    return suggest_route(
        [(s.store_order_id, s.lat, s.lng) for s in pending],
        delivery.delivery_lat,
        delivery.delivery_lng,
    )


class ConfirmPickup:
    """La confirma la TIENDA (no el repartidor): recibe el código de manos del repartidor y lo
    ingresa. La autorización usa `store_owner_user_id`, copiado en el `DeliveryStop` al reclamar
    la entrega — no hace falta volver a consultar `stores`."""

    def __init__(
        self, uow_factory: UnitOfWorkFactory, ordering: OrderingPort, clock: Clock
    ) -> None:
        self._uow_factory = uow_factory
        self._ordering = ordering
        self._clock = clock

    async def __call__(self, store_order_id: UUID, user_id: UUID, code: str) -> DeliveryStop:
        async with self._uow_factory() as uow:
            delivery = await uow.deliveries.get_by_stop_store_order(store_order_id)
            if delivery is None:
                raise DeliveryNotFound()
            stop = next(s for s in delivery.stops if s.store_order_id == store_order_id)
            if stop.store_owner_user_id != user_id:
                raise NotStopStoreOwner()
            confirmed = delivery.confirm_pickup(stop.store_id, code, self._clock.now())
            await uow.deliveries.update(delivery)
            await uow.commit()
        await self._ordering.mark_store_order_handed_over(store_order_id)
        return confirmed


class ConfirmDelivery:
    def __init__(self, uow_factory: UnitOfWorkFactory, wallet: WalletPort, clock: Clock) -> None:
        self._uow_factory = uow_factory
        self._wallet = wallet
        self._clock = clock

    async def __call__(self, delivery_id: UUID, user_id: UUID, code: str) -> Delivery:
        async with self._uow_factory() as uow:
            delivery = await uow.deliveries.get(delivery_id)
            if delivery is None:
                raise DeliveryNotFound()
            if not delivery.is_owned_by_courier(user_id):
                raise NotDeliveryCourier()
            delivery.confirm_delivery(code, self._clock.now())
            await uow.deliveries.update(delivery)
            await uow.commit()
        earnings = compute_earnings_cop(len(delivery.stops))
        await self._wallet.credit_courier(delivery.courier_id, earnings, delivery.id)
        return delivery


class CancelDelivery:
    def __init__(self, uow_factory: UnitOfWorkFactory, clock: Clock) -> None:
        self._uow_factory = uow_factory
        self._clock = clock

    async def __call__(self, delivery_id: UUID, user_id: UUID) -> Delivery:
        async with self._uow_factory() as uow:
            delivery = await uow.deliveries.get(delivery_id)
            if delivery is None:
                raise DeliveryNotFound()
            if not delivery.is_owned_by_courier(user_id):
                raise NotDeliveryCourier()
            delivery.cancel(self._clock.now())
            await uow.deliveries.update(delivery)
            await uow.commit()
        return delivery


class GetDeliveryForCustomer:
    """El cliente consulta su código de entrega (y el estado del repartidor) por `order_id`, no
    por `delivery_id` — no tiene forma de conocer ese id, solo el de su propio pedido."""

    def __init__(self, uow_factory: UnitOfWorkFactory, ordering: OrderingPort) -> None:
        self._uow_factory = uow_factory
        self._ordering = ordering

    async def __call__(self, order_id: UUID, user_id: UUID) -> Delivery | None:
        customer_id = await self._ordering.get_order_customer_id(order_id)
        if customer_id is None or customer_id != user_id:
            raise NotOrderCustomer()
        async with self._uow_factory() as uow:
            return await uow.deliveries.get_by_order(order_id)


class GetDeliveryCourierUserIdRaw:
    """Lectura interna: el `user_id` (no el id de la entrega) del repartidor asignado al pedido,
    para el `DispatchPort` de `incidents` (necesita saber si quien reporta es el repartidor de ese
    pedido). Nunca se expone por HTTP."""

    def __init__(self, uow_factory: UnitOfWorkFactory) -> None:
        self._uow_factory = uow_factory

    async def __call__(self, order_id: UUID) -> UUID | None:
        async with self._uow_factory() as uow:
            delivery = await uow.deliveries.get_by_order(order_id)
        return delivery.courier_id if delivery else None
