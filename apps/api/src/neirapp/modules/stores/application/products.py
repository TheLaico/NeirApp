from dataclasses import dataclass
from uuid import UUID

from neirapp.modules.stores.application.dto import ProductWithStore
from neirapp.modules.stores.application.ports import UnitOfWork, UnitOfWorkFactory
from neirapp.modules.stores.domain.entities import Product, StoreCategory
from neirapp.modules.stores.domain.errors import NotStoreOwner, ProductNotFound, StoreNotFound
from neirapp.shared.application.ports import Clock


@dataclass(frozen=True)
class CreateProductCommand:
    name: str
    description: str
    price_cop: int
    image_url: str | None = None


async def _require_owned_store(uow: UnitOfWork, store_id: UUID, user_id: UUID) -> None:
    store = await uow.stores.get(store_id)
    if store is None:
        raise StoreNotFound()
    if not store.is_owned_by(user_id):
        raise NotStoreOwner()


class CreateProduct:
    def __init__(self, uow_factory: UnitOfWorkFactory, clock: Clock) -> None:
        self._uow_factory = uow_factory
        self._clock = clock

    async def __call__(
        self, store_id: UUID, owner_user_id: UUID, cmd: CreateProductCommand
    ) -> Product:
        async with self._uow_factory() as uow:
            await _require_owned_store(uow, store_id, owner_user_id)
            product = Product.create(
                store_id=store_id,
                name=cmd.name,
                description=cmd.description,
                price_cop=cmd.price_cop,
                image_url=cmd.image_url,
                now=self._clock.now(),
            )
            await uow.products.add(product)
            await uow.commit()
        return product


class ListStoreProducts:
    def __init__(self, uow_factory: UnitOfWorkFactory) -> None:
        self._uow_factory = uow_factory

    async def __call__(self, store_id: UUID, *, only_available: bool = False) -> list[Product]:
        async with self._uow_factory() as uow:
            if await uow.stores.get(store_id) is None:
                raise StoreNotFound()
            return await uow.products.list_by_store(store_id, only_available=only_available)


async def _load_owned_product(
    uow: UnitOfWork, store_id: UUID, product_id: UUID, user_id: UUID
) -> Product:
    await _require_owned_store(uow, store_id, user_id)
    product = await uow.products.get(product_id)
    if product is None or product.store_id != store_id:
        raise ProductNotFound()
    return product


class GetProductRaw:
    """Lectura interna para el `CatalogPort` de `ordering` (ver `GetStoreRaw` en stores.py)."""

    def __init__(self, uow_factory: UnitOfWorkFactory) -> None:
        self._uow_factory = uow_factory

    async def __call__(self, store_id: UUID, product_id: UUID) -> Product | None:
        async with self._uow_factory() as uow:
            product = await uow.products.get(product_id)
        if product is None or product.store_id != store_id:
            return None
        return product


class UpdateProduct:
    def __init__(self, uow_factory: UnitOfWorkFactory) -> None:
        self._uow_factory = uow_factory

    async def __call__(
        self,
        store_id: UUID,
        product_id: UUID,
        owner_user_id: UUID,
        *,
        name: str | None = None,
        description: str | None = None,
        price_cop: int | None = None,
        image_url: str | None = None,
    ) -> Product:
        async with self._uow_factory() as uow:
            product = await _load_owned_product(uow, store_id, product_id, owner_user_id)
            product.update(
                name=name, description=description, price_cop=price_cop, image_url=image_url
            )
            await uow.products.update(product)
            await uow.commit()
        return product


class SetProductAvailability:
    def __init__(self, uow_factory: UnitOfWorkFactory) -> None:
        self._uow_factory = uow_factory

    async def __call__(
        self, store_id: UUID, product_id: UUID, owner_user_id: UUID, *, is_available: bool
    ) -> Product:
        async with self._uow_factory() as uow:
            product = await _load_owned_product(uow, store_id, product_id, owner_user_id)
            product.set_available(is_available)
            await uow.products.update(product)
            await uow.commit()
        return product


class DeleteProduct:
    def __init__(self, uow_factory: UnitOfWorkFactory) -> None:
        self._uow_factory = uow_factory

    async def __call__(self, store_id: UUID, product_id: UUID, owner_user_id: UUID) -> None:
        async with self._uow_factory() as uow:
            await _load_owned_product(uow, store_id, product_id, owner_user_id)
            await uow.products.delete(product_id)
            await uow.commit()


@dataclass(frozen=True)
class SearchProductsQuery:
    text: str
    category: StoreCategory | None = None
    max_price_cop: int | None = None
    sort: str = "relevance"


class SearchProducts:
    """Búsqueda simple (LIKE, portable entre SQLite y Postgres).

    Etapas futuras (Fase 4 del roadmap): tsvector + unaccent + pg_trgm, luego un motor dedicado.
    """

    def __init__(self, uow_factory: UnitOfWorkFactory) -> None:
        self._uow_factory = uow_factory

    async def __call__(self, query: SearchProductsQuery) -> list[ProductWithStore]:
        async with self._uow_factory() as uow:
            results = await uow.products.search(
                query.text,
                category=query.category,
                max_price_cop=query.max_price_cop,
                sort=query.sort,
            )
        return [ProductWithStore(product, store) for product, store in results]
