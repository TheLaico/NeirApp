from uuid import UUID

from neirapp.modules.stores.application.ports import UnitOfWork
from neirapp.modules.stores.domain.entities import Store, normalize_image_url
from neirapp.modules.stores.domain.errors import PhotoLimitReached

# Cada comercio puede tener hasta 20 fotos: la de la tienda más las de sus productos. Subir más
# requiere que el desarrollador cambie este número (cuida el espacio de almacenamiento).
MAX_PHOTOS_PER_STORE = 20


async def photos_in_use(uow: UnitOfWork, store: Store) -> int:
    products = await uow.products.list_by_store(store.id)
    return int(store.image_url is not None) + sum(1 for p in products if p.image_url is not None)


async def ensure_can_add_photo(
    uow: UnitOfWork, store_id: UUID, *, new_url: str | None, current_url: str | None
) -> None:
    """Falla si esta operación agrega una foto (no reemplaza ni quita una) y ya se llegó al tope."""
    adds_one = normalize_image_url(new_url) is not None and current_url is None
    if not adds_one:
        return
    store = await uow.stores.get(store_id)
    if store is not None and await photos_in_use(uow, store) >= MAX_PHOTOS_PER_STORE:
        raise PhotoLimitReached()
