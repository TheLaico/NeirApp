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

    No hay aprobación de un admin todavía (backoffice pendiente, ver roadmap Fase 2/4).
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
    def __init__(self, uow_factory: UnitOfWorkFactory) -> None:
        self._uow_factory = uow_factory

    async def __call__(self, store_id: UUID) -> Store:
        async with self._uow_factory() as uow:
            store = await uow.stores.get(store_id)
        if store is None:
            raise StoreNotFound()
        return store


class ListStores:
    def __init__(self, uow_factory: UnitOfWorkFactory) -> None:
        self._uow_factory = uow_factory

    async def __call__(self, *, category: StoreCategory | None = None) -> list[Store]:
        async with self._uow_factory() as uow:
            return await uow.stores.list_all(category=category)


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
