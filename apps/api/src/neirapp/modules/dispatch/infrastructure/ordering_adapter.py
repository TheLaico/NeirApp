from uuid import UUID

from neirapp.modules.dispatch.application.dto import ClaimableOrderSnapshot, ClaimableStopSnapshot
from neirapp.modules.ordering.application.app import OrderingApp
from neirapp.modules.ordering.domain.entities import Order, StoreOrderStatus

_CLAIMABLE = frozenset(
    {StoreOrderStatus.ACCEPTED, StoreOrderStatus.PREPARING, StoreOrderStatus.READY}
)


def _to_snapshot(order: Order) -> ClaimableOrderSnapshot | None:
    stops = [
        ClaimableStopSnapshot(
            store_order_id=so.id,
            store_id=so.store_id,
            store_name=so.store_name,
            status=so.status.value,
        )
        for so in order.store_orders
        if so.status in _CLAIMABLE
    ]
    if not stops:
        return None
    return ClaimableOrderSnapshot(
        order_id=order.id,
        customer_id=order.customer_id,
        delivery_lat=order.delivery_lat,
        delivery_lng=order.delivery_lng,
        delivery_notes=order.delivery_notes,
        stops=stops,
        delivery_fee_cop=order.delivery_fee_cop,
        courier_earnings_cop=order.courier_earnings_cop,
    )


class OrderingAdapter:
    """Implementa `OrderingPort` sobre la fachada pública de `ordering` (`OrderingApp`). Único
    punto de `dispatch` que sabe que `ordering` existe — vive en infraestructura, verificado por
    import-linter (`el dominio/aplicación de dispatch no depende de ordering ni stores`)."""

    def __init__(self, ordering: OrderingApp) -> None:
        self._ordering = ordering

    async def get_claimable_order(self, order_id: UUID) -> ClaimableOrderSnapshot | None:
        order = await self._ordering.get_order_raw(order_id)
        return _to_snapshot(order) if order else None

    async def list_claimable_orders(self) -> list[ClaimableOrderSnapshot]:
        orders = await self._ordering.list_claimable_orders()
        snapshots = (_to_snapshot(o) for o in orders)
        return [s for s in snapshots if s is not None]

    async def is_store_order_ready(self, order_id: UUID, store_order_id: UUID) -> bool:
        order = await self._ordering.get_order_raw(order_id)
        if order is None:
            return False
        return any(
            so.id == store_order_id and so.status == StoreOrderStatus.READY
            for so in order.store_orders
        )

    async def ready_store_order_ids(self, order_id: UUID) -> set[UUID]:
        order = await self._ordering.get_order_raw(order_id)
        if order is None:
            return set()
        return {so.id for so in order.store_orders if so.status == StoreOrderStatus.READY}

    async def mark_store_order_handed_over(self, store_order_id: UUID) -> None:
        await self._ordering.mark_store_order_handed_over_raw(store_order_id)

    async def get_order_customer_id(self, order_id: UUID) -> UUID | None:
        order = await self._ordering.get_order_raw(order_id)
        return order.customer_id if order else None
