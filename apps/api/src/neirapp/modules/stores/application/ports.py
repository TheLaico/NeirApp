from collections.abc import Callable
from types import TracebackType
from typing import Protocol, Self
from uuid import UUID

from neirapp.modules.stores.domain.entities import Product, Store, StoreCategory
from neirapp.modules.stores.domain.promotions import ProductPromotion


class StoreRepository(Protocol):
    async def add(self, store: Store) -> None: ...

    async def get(self, store_id: UUID) -> Store | None: ...

    async def get_by_owner(self, owner_user_id: UUID) -> Store | None: ...

    async def list_all(
        self,
        *,
        category: StoreCategory | None = None,
        is_approved: bool | None = None,
        is_listed: bool | None = None,
    ) -> list[Store]: ...

    async def update(self, store: Store) -> None: ...


class ProductRepository(Protocol):
    async def add(self, product: Product) -> None: ...

    async def get(self, product_id: UUID) -> Product | None: ...

    async def list_by_store(
        self, store_id: UUID, *, only_available: bool = False
    ) -> list[Product]: ...

    async def search(
        self,
        query: str,
        *,
        category: StoreCategory | None = None,
        max_price_cop: int | None = None,
        sort: str = "relevance",
        limit: int = 50,
    ) -> list[tuple[Product, Store]]: ...

    async def update(self, product: Product) -> None: ...

    async def delete(self, product_id: UUID) -> None: ...


class PromotionRepository(Protocol):
    async def save(self, promotion: ProductPromotion) -> None: ...

    async def get(self, promotion_id: UUID) -> ProductPromotion | None: ...

    async def list_by_store(self, store_id: UUID) -> list[ProductPromotion]: ...

    async def list_all(self) -> list[ProductPromotion]: ...


class UnitOfWork(Protocol):
    @property
    def stores(self) -> StoreRepository: ...

    @property
    def products(self) -> ProductRepository: ...

    @property
    def promotions(self) -> PromotionRepository: ...

    async def __aenter__(self) -> Self: ...

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        tb: TracebackType | None,
    ) -> None: ...

    async def commit(self) -> None: ...

    async def rollback(self) -> None: ...


UnitOfWorkFactory = Callable[[], UnitOfWork]
