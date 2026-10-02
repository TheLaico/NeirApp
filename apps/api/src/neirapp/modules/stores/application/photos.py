from uuid import UUID

from neirapp.modules.stores.application.ports import UnitOfWork
from neirapp.modules.stores.domain.entities import Store, normalize_image_url
from neirapp.modules.stores.domain.errors import PhotoLimitReached

# Cada comercio puede tener hasta 20 fotos: la de la tienda, su logo y las de sus productos.
# Subir más requiere que el desarrollador cambie este número (cuida el espacio de almacenamiento).
MAX_PHOTOS_PER_STORE = 20


async def photos_in_use(uow: UnitOfWork, store: Store) -> int:
    products = await uow.products.list_by_store(store.id)
    own = int(store.image_url is not None) + int(store.logo_url is not None)
    return own + sum(1 for p in products if p.image_url is not None)


def _adds(new_url: str | None, current_url: str | None) -> int:
    return int(normalize_image_url(new_url) is not None and current_url is None)


async def ensure_can_add_photo(
    uow: UnitOfWork,
    store_id: UUID,
    *,
    new_url: str | None,
    current_url: str | None,
    also: tuple[str | None, str | None] | None = None,
) -> None:
    """Falla si esta operación agrega fotos (no reemplaza ni quita) y con ellas pasa del tope.
    `also` es otra (nueva, actual) que cambia en la misma operación, como el logo de la tienda."""
    adds = _adds(new_url, current_url) + (_adds(*also) if also else 0)
    if not adds:
        return
    store = await uow.stores.get(store_id)
    if store is not None and await photos_in_use(uow, store) + adds > MAX_PHOTOS_PER_STORE:
        raise PhotoLimitReached()
