from uuid import UUID

from neirapp.modules.dispatch.application.app import DispatchApp


class DispatchAdapter:
    """Implementa `DispatchPort` sobre la fachada pública de `dispatch` (`DispatchApp`)."""

    def __init__(self, dispatch: DispatchApp) -> None:
        self._dispatch = dispatch

    async def get_delivery_courier_user_id(self, order_id: UUID) -> UUID | None:
        return await self._dispatch.get_delivery_courier_user_id_raw(order_id)
