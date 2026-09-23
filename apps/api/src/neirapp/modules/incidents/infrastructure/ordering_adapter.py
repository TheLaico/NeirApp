from uuid import UUID

from neirapp.modules.ordering.application.app import OrderingApp


class OrderingAdapter:
    """Implementa `OrderingPort` sobre la fachada pública de `ordering` (`OrderingApp`)."""

    def __init__(self, ordering: OrderingApp) -> None:
        self._ordering = ordering

    async def get_order_customer_id(self, order_id: UUID) -> UUID | None:
        order = await self._ordering.get_order_raw(order_id)
        return order.customer_id if order else None
