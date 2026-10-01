from collections.abc import Callable
from dataclasses import dataclass
from datetime import date
from uuid import UUID

from neirapp.modules.stores.application.photos import ensure_can_add_photo
from neirapp.modules.stores.application.ports import UnitOfWorkFactory
from neirapp.modules.stores.domain.entities import Store, StoreCategory
from neirapp.modules.stores.domain.errors import NotStoreOwner, OwnerAlreadyHasStore, StoreNotFound
from neirapp.modules.stores.domain.schedule import DayHours, local_time
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


class AdminCreateStore:
    """Un admin crea la tienda de un comerciante: ya nace aprobada y con ese comerciante de dueño.

    Un comerciante tiene una sola tienda (el panel `/stores/me` asume eso), por eso se rechaza si
    ya tiene otra. Quién es ese dueño y si tiene el rol de comerciante lo valida la ruta.
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
        store.set_approved(True)
        async with self._uow_factory() as uow:
            if await uow.stores.get_by_owner(owner_user_id) is not None:
                raise OwnerAlreadyHasStore()
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
        self,
        *,
        category: StoreCategory | None = None,
        is_approved: bool | None = True,
        is_listed: bool | None = True,
    ) -> list[Store]:
        """El público ve solo las aprobadas y visibles; el admin puede pedir todas con `None`."""
        async with self._uow_factory() as uow:
            return await uow.stores.list_all(
                category=category, is_approved=is_approved, is_listed=is_listed
            )


class AdminUpdateStore:
    """El administrador cambia el dueño (su id ya resuelto por correo), la posición y si la tienda
    aparece en el mapa. Un comerciante tiene una sola tienda: el nuevo dueño no puede tener otra."""

    def __init__(self, uow_factory: UnitOfWorkFactory) -> None:
        self._uow_factory = uow_factory

    async def __call__(
        self,
        store_id: UUID,
        *,
        owner_user_id: UUID | None = None,
        lat: float | None = None,
        lng: float | None = None,
        is_listed: bool | None = None,
    ) -> Store:
        async with self._uow_factory() as uow:
            store = await uow.stores.get(store_id)
            if store is None:
                raise StoreNotFound()
            if owner_user_id is not None and owner_user_id != store.owner_user_id:
                if await uow.stores.get_by_owner(owner_user_id) is not None:
                    raise OwnerAlreadyHasStore()
                store.transfer_to(owner_user_id)
            if lat is not None and lng is not None:
                store.relocate(lat=lat, lng=lng)
            if is_listed is not None:
                store.is_listed = is_listed
                if not is_listed:
                    store.recommended_position = None  # una tienda oculta no puede ser recomendada
            await uow.stores.update(store)
            await uow.commit()
        return store


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


class SetRecommendedStores:
    """El administrador decide qué tiendas se recomiendan y en qué orden (la primera de la lista
    es la posición 1). Las que no están en la lista dejan de ser recomendadas."""

    def __init__(self, uow_factory: UnitOfWorkFactory) -> None:
        self._uow_factory = uow_factory

    async def __call__(self, store_ids: list[UUID]) -> list[Store]:
        ordered = list(dict.fromkeys(store_ids))  # sin repetidas, conservando el orden
        async with self._uow_factory() as uow:
            stores = {s.id: s for s in await uow.stores.list_all()}
            for store_id in ordered:
                store = stores.get(store_id)
                if store is None or not store.is_visible_to_customers():
                    raise StoreNotFound()
            position = {store_id: i + 1 for i, store_id in enumerate(ordered)}
            for store in stores.values():
                wanted = position.get(store.id)
                if store.recommended_position != wanted:
                    store.recommended_position = wanted
                    await uow.stores.update(store)
            await uow.commit()
        return [stores[store_id] for store_id in ordered]


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
        image_url: str | None = None,
    ) -> Store:
        async with self._uow_factory() as uow:
            store = await uow.stores.get(store_id)
            if store is None:
                raise StoreNotFound()
            if not store.is_owned_by(user_id):
                raise NotStoreOwner()
            await ensure_can_add_photo(
                uow, store_id, new_url=image_url, current_url=store.image_url
            )
            store.update_profile(
                name=name, category=category, description=description, image_url=image_url
            )
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


class _EditSchedule:
    """Base de los casos de uso que cambian el horario: solo el dueño, y todo en una transacción."""

    def __init__(self, uow_factory: UnitOfWorkFactory, clock: Clock) -> None:
        self._uow_factory = uow_factory
        self._clock = clock

    async def _apply(self, store_id: UUID, user_id: UUID, change: Callable[[Store], None]) -> Store:
        async with self._uow_factory() as uow:
            store = await uow.stores.get(store_id)
            if store is None:
                raise StoreNotFound()
            if not store.is_owned_by(user_id):
                raise NotStoreOwner()
            change(store)
            await uow.stores.update(store)
            await uow.commit()
        return store


class SetStoreHours(_EditSchedule):
    async def __call__(self, store_id: UUID, user_id: UUID, days: list[DayHours]) -> Store:
        return await self._apply(store_id, user_id, lambda s: s.schedule.set_week(days))


class ClearStoreHours(_EditSchedule):
    """Quita el horario semanal: la tienda vuelve a depender solo de su interruptor."""

    async def __call__(self, store_id: UUID, user_id: UUID) -> Store:
        return await self._apply(store_id, user_id, lambda s: s.schedule.clear_week())


class AddClosedDate(_EditSchedule):
    async def __call__(self, store_id: UUID, user_id: UUID, day: date, reason: str) -> Store:
        today = local_time(self._clock.now()).date()
        return await self._apply(
            store_id, user_id, lambda s: s.schedule.add_closed_date(day, reason, today)
        )


class RemoveClosedDate(_EditSchedule):
    async def __call__(self, store_id: UUID, user_id: UUID, day: date) -> Store:
        return await self._apply(store_id, user_id, lambda s: s.schedule.remove_closed_date(day))


class GetMyStore:
    """La tienda del dueño actual, si tiene una. Para el panel `/mi-tienda`."""

    def __init__(self, uow_factory: UnitOfWorkFactory) -> None:
        self._uow_factory = uow_factory

    async def __call__(self, owner_user_id: UUID) -> Store | None:
        async with self._uow_factory() as uow:
            return await uow.stores.get_by_owner(owner_user_id)
