from uuid import UUID

from neirapp.modules.ordering.application.dto import ProductSnapshot, StoreSnapshot
from neirapp.modules.stores.application.app import StoresApp


class StoresCatalogAdapter:
    """Implementa `CatalogPort` sobre la fachada pública de `stores` (`StoresApp`).

    Es el único punto de todo el módulo `ordering` que sabe que `stores` existe — vive en
    infraestructura, no en dominio ni aplicación, y los contratos de import-linter lo verifican
    (`el dominio/aplicación de ordering no depende de stores`).
    """

    def __init__(self, stores: StoresApp) -> None:
        self._stores = stores

    async def get_store(self, store_id: UUID) -> StoreSnapshot | None:
        store = await self._stores.get_store_raw(store_id)
        if store is None:
            return None
        return StoreSnapshot(
            id=store.id,
            name=store.name,
            owner_user_id=store.owner_user_id,
            is_open=store.is_open,
            is_approved=store.is_approved,
        )

    async def get_product(self, store_id: UUID, product_id: UUID) -> ProductSnapshot | None:
        product = await self._stores.get_product_raw(store_id, product_id)
        if product is None:
            return None
        return ProductSnapshot(
            id=product.id,
            name=product.name,
            price_cop=product.price_cop,
            is_available=product.is_available,
        )
