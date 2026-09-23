from uuid import UUID

from neirapp.modules.ordering.application.app import OrderingApp
from neirapp.modules.reviews.application.dto import ReviewableStoreOrderSnapshot


class OrderingAdapter:
    """Implementa `OrderingPort` sobre la fachada pública de `ordering` (`OrderingApp`). Único
    punto de `reviews` que sabe que `ordering` existe — verificado por import-linter."""

    def __init__(self, ordering: OrderingApp) -> None:
        self._ordering = ordering

    async def get_store_order(self, store_order_id: UUID) -> ReviewableStoreOrderSnapshot | None:
        view = await self._ordering.get_store_order_view_raw(store_order_id)
        if view is None:
            return None
        return ReviewableStoreOrderSnapshot(
            store_order_id=view.store_order.id,
            order_id=view.order_id,
            store_id=view.store_order.store_id,
            customer_id=view.customer_id,
            status=view.store_order.status.value,
        )
