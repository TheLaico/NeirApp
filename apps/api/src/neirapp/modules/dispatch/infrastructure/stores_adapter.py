from uuid import UUID

from neirapp.modules.dispatch.application.dto import StoreLocationSnapshot
from neirapp.modules.stores.application.app import StoresApp


class StoresAdapter:
    """Implementa `StoresPort` sobre la fachada pública de `stores` (`StoresApp`)."""

    def __init__(self, stores: StoresApp) -> None:
        self._stores = stores

    async def get_store(self, store_id: UUID) -> StoreLocationSnapshot | None:
        store = await self._stores.get_store_raw(store_id)
        if store is None:
            return None
        return StoreLocationSnapshot(
            id=store.id,
            name=store.name,
            lat=store.lat,
            lng=store.lng,
            owner_user_id=store.owner_user_id,
        )
