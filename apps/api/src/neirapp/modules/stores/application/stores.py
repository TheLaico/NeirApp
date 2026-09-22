from dataclasses import dataclass
from uuid import UUID

from neirapp.modules.stores.application.ports import UnitOfWorkFactory
from neirapp.modules.stores.domain.entities import Store, StoreCategory
from neirapp.modules.stores.domain.errors import NotStoreOwner, StoreNotFound
from neirapp.shared.application.ports import Clock


@dataclass(frozen=True)
class CreateStoreCommand:
    name: str
    category: StoreCategory
    description: str
    lat: float
    lng: float


class CreateStore:
    """Cualquier usuario autenticado puede abrir una tienda: es dueño desde que la crea.

    Nace sin aprobar (`Store.create` la deja `is_approved=False`): un admin debe aprobarla antes
    de que aparezca en el mapa, la búsqueda o su propia página pública.
    """

    def __init__(self, uow_factory: UnitOfWorkFactory, clock: Clock) -> None:
        self._uow_factory = uow_factory
        self._clock = clock

    async def __call__(self, owner_user_id: UUID, cmd: CreateStoreCommand) -> Store:
        store = Store.create(
            owner_user_id=owner_user_id,
            name=cmd.name,
            category=cmd.category,
            description=cmd.description,
            lat=cmd.lat,
            lng=cmd.lng,
            now=self._clock.now(),
        )
        async with self._uow_factory() as uow:
            await uow.stores.add(store)
            await uow.commit()
        return store


class GetStore:
    """Vista pública de una tienda: 404 si no existe *o* si un admin aún no la aprobó.

    No distinguir los dos casos evita revelarle a un desconocido que una tienda pendiente existe.
    """

    def __init__(self, uow_factory: UnitOfWorkFactory) -> None:
        self._uow_factory = uow_factory

    async def __call__(self, store_id: UUID) -> Store:
        async with self._uow_factory() as uow:
            store = await uow.stores.get(store_id)
        if store is None or not store.is_visible_to_customers():
            raise StoreNotFound()
        return store


class ListStores:
    """Listado público (mapa): solo tiendas aprobadas, salvo que un admin pida lo contrario."""

    def __init__(self, uow_factory: UnitOfWorkFactory) -> None:
        self._uow_factory = uow_factory

    async def __call__(
        self, *, category: StoreCategory | None = None, is_approved: bool | None = True
    ) -> list[Store]:
        async with self._uow_factory() as uow:
            return await uow.stores.list_all(category=category, is_approved=is_approved)


class GetStoreRaw:
    """Lectura sin filtrar por aprobación, para consumo interno de otros módulos (el adaptador de
    `CatalogPort` que usa `ordering` para armar pedidos). Nunca se expone por HTTP: un pedido debe
    poder validar que una tienda existe y decidir *por qué* no está disponible (no aprobada,
    cerrada) con su propio mensaje, en vez de heredar el 404 genérico de la vista pública."""

    def __init__(self, uow_factory: UnitOfWorkFactory) -> None:
        self._uow_factory = uow_factory

    async def __call__(self, store_id: UUID) -> Store | None:
        async with self._uow_factory() as uow:
            return await uow.stores.get(store_id)


class SetStoreApproval:
    """Aprobar o rechazar una tienda. Reservado a admins (ver `require_roles` en el router)."""

    def __init__(self, uow_factory: UnitOfWorkFactory) -> None:
        self._uow_factory = uow_factory

    async def __call__(self, store_id: UUID, *, is_approved: bool) -> Store:
        async with self._uow_factory() as uow:
            store = await uow.stores.get(store_id)
            if store is None:
                raise StoreNotFound()
            store.set_approved(is_approved)
            await uow.stores.update(store)
            await uow.commit()
        return store


async def _load_owned(uow_factory: UnitOfWorkFactory, store_id: UUID, user_id: UUID) -> Store:
    async with uow_factory() as uow:
        store = await uow.stores.get(store_id)
        if store is None:
            raise StoreNotFound()
        if not store.is_owned_by(user_id):
            raise NotStoreOwner()
        return store


class UpdateStore:
    def __init__(self, uow_factory: UnitOfWorkFactory) -> None:
        self._uow_factory = uow_factory

    async def __call__(
        self,
        store_id: UUID,
        user_id: UUID,
        *,
        name: str | None = None,
        category: StoreCategory | None = None,
        description: str | None = None,
    ) -> Store:
        async with self._uow_factory() as uow:
            store = await uow.stores.get(store_id)
            if store is None:
                raise StoreNotFound()
            if not store.is_owned_by(user_id):
                raise NotStoreOwner()
            store.update_profile(name=name, category=category, description=description)
            await uow.stores.update(store)
            await uow.commit()
        return store


class SetStoreOpen:
    def __init__(self, uow_factory: UnitOfWorkFactory) -> None:
        self._uow_factory = uow_factory

    async def __call__(self, store_id: UUID, user_id: UUID, *, is_open: bool) -> Store:
        async with self._uow_factory() as uow:
            store = await uow.stores.get(store_id)
            if store is None:
                raise StoreNotFound()
            if not store.is_owned_by(user_id):
                raise NotStoreOwner()
            store.set_open(is_open)
            await uow.stores.update(store)
            await uow.commit()
        return store


class GetMyStore:
    """La tienda del dueño actual, si tiene una. Para el panel `/mi-tienda`."""

    def __init__(self, uow_factory: UnitOfWorkFactory) -> None:
        self._uow_factory = uow_factory

    async def __call__(self, owner_user_id: UUID) -> Store | None:
        async with self._uow_factory() as uow:
            return await uow.stores.get_by_owner(owner_user_id)
