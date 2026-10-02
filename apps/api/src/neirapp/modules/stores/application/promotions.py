"""Destacar un producto: el comerciante paga $ 7.000 y el producto sale en "Productos recomendados"
del inicio, en la categoría de su tienda. Sin pasarela: paga por fuera, reporta el comprobante y el
administrador lo confirma o lo rechaza (igual que los planes de Hospedaje)."""

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from neirapp.modules.stores.application.dto import ProductWithStore
from neirapp.modules.stores.application.ports import UnitOfWork, UnitOfWorkFactory
from neirapp.modules.stores.domain.entities import Product, Store
from neirapp.modules.stores.domain.errors import (
    NotStoreOwner,
    ProductNotFound,
    ProductNotPromotable,
    PromotionNotFound,
    PromotionPending,
    StoreNotFound,
)
from neirapp.modules.stores.domain.promotions import ProductPromotion, PromotionStatus
from neirapp.shared.application.ports import Clock


@dataclass(frozen=True)
class PromotionView:
    """Un pago para destacar, con lo necesario para mostrarlo (el producto pudo borrarse)."""

    promotion: ProductPromotion
    product: Product | None
    store: Store | None


async def _owned_store(uow: UnitOfWork, store_id: UUID, user_id: UUID) -> Store:
    store = await uow.stores.get(store_id)
    if store is None:
        raise StoreNotFound()
    if not store.is_owned_by(user_id):
        raise NotStoreOwner()
    return store


async def _views(uow: UnitOfWork, promotions: list[ProductPromotion]) -> list[PromotionView]:
    stores: dict[UUID, Store | None] = {}
    products: dict[UUID, Product | None] = {}
    views = []
    for p in promotions:
        if p.store_id not in stores:
            stores[p.store_id] = await uow.stores.get(p.store_id)
        if p.product_id not in products:
            products[p.product_id] = await uow.products.get(p.product_id)
        views.append(PromotionView(p, products[p.product_id], stores[p.store_id]))
    return views


def _paid_until(promotions: list[ProductPromotion], product_id: UUID) -> datetime | None:
    ends = [
        p.expires_at
        for p in promotions
        if p.product_id == product_id and p.status is PromotionStatus.APPROVED and p.expires_at
    ]
    return max(ends, default=None)


class ListMyPromotions:
    def __init__(self, uow_factory: UnitOfWorkFactory) -> None:
        self._uow_factory = uow_factory

    async def __call__(self, store_id: UUID, user_id: UUID) -> list[PromotionView]:
        async with self._uow_factory() as uow:
            await _owned_store(uow, store_id, user_id)
            return await _views(uow, await uow.promotions.list_by_store(store_id))


class RequestPromotion:
    """El comerciante pagó (por fuera) para destacar un producto y lo reporta para confirmarlo."""

    def __init__(self, uow_factory: UnitOfWorkFactory, clock: Clock) -> None:
        self._uow_factory = uow_factory
        self._clock = clock

    async def __call__(
        self, store_id: UUID, user_id: UUID, product_id: UUID, reference: str
    ) -> PromotionView:
        async with self._uow_factory() as uow:
            store = await _owned_store(uow, store_id, user_id)
            product = await uow.products.get(product_id)
            if product is None or product.store_id != store_id:
                raise ProductNotFound()
            # Solo productos de la tienda que se pueden agregar al carrito (no los agotados).
            if not product.is_available:
                raise ProductNotPromotable()
            mine = await uow.promotions.list_by_store(store_id)
            if any(
                p.product_id == product_id and p.status is PromotionStatus.PENDING for p in mine
            ):
                raise PromotionPending()
            promotion = ProductPromotion.request(store_id, product_id, reference, self._clock.now())
            await uow.promotions.save(promotion)
            await uow.commit()
        return PromotionView(promotion, product, store)


class CancelPromotion:
    def __init__(self, uow_factory: UnitOfWorkFactory) -> None:
        self._uow_factory = uow_factory

    async def __call__(self, store_id: UUID, user_id: UUID, promotion_id: UUID) -> PromotionView:
        async with self._uow_factory() as uow:
            await _owned_store(uow, store_id, user_id)
            promotion = await uow.promotions.get(promotion_id)
            if promotion is None or promotion.store_id != store_id:
                raise PromotionNotFound()
            promotion.cancel()
            await uow.promotions.save(promotion)
            await uow.commit()
            return (await _views(uow, [promotion]))[0]


class ListPromotedProducts:
    """Público: los productos destacados hoy, de tiendas visibles y que se pueden pedir. Los que
    se destacaron más recientemente van primero."""

    def __init__(self, uow_factory: UnitOfWorkFactory, clock: Clock) -> None:
        self._uow_factory = uow_factory
        self._clock = clock

    async def __call__(self) -> list[ProductWithStore]:
        now = self._clock.now()
        async with self._uow_factory() as uow:
            active = [p for p in await uow.promotions.list_all() if p.is_active(now)]
            active.sort(key=lambda p: p.starts_at or now, reverse=True)
            seen: set[UUID] = set()
            results = []
            for view in await _views(uow, active):
                product, store = view.product, view.store
                if product is None or store is None or product.id in seen:
                    continue
                if not product.is_available or not store.is_visible_to_customers():
                    continue
                seen.add(product.id)
                results.append(ProductWithStore(product=product, store=store))
            return results


class ListPromotionsForAdmin:
    """Todos los pagos para destacar productos; primero los que esperan confirmación."""

    def __init__(self, uow_factory: UnitOfWorkFactory) -> None:
        self._uow_factory = uow_factory

    async def __call__(self) -> list[PromotionView]:
        async with self._uow_factory() as uow:
            everything = await uow.promotions.list_all()
            pending = [p for p in everything if p.status is PromotionStatus.PENDING]
            pending.sort(key=lambda p: p.requested_at)
            rest = [p for p in everything if p.status is not PromotionStatus.PENDING]
            return await _views(uow, pending + rest)


class ApprovePromotion:
    """El administrador vio el pago: el producto se destaca 30 días. Si ya estaba destacado, los
    días nuevos empiezan cuando terminen los que tiene: no pierde días."""

    def __init__(self, uow_factory: UnitOfWorkFactory, clock: Clock) -> None:
        self._uow_factory = uow_factory
        self._clock = clock

    async def __call__(self, promotion_id: UUID) -> PromotionView:
        now = self._clock.now()
        async with self._uow_factory() as uow:
            promotion = await uow.promotions.get(promotion_id)
            if promotion is None:
                raise PromotionNotFound()
            current = _paid_until(
                await uow.promotions.list_by_store(promotion.store_id), promotion.product_id
            )
            promotion.approve(current if current and current > now else now, now)
            await uow.promotions.save(promotion)
            await uow.commit()
            return (await _views(uow, [promotion]))[0]


class RejectPromotion:
    def __init__(self, uow_factory: UnitOfWorkFactory, clock: Clock) -> None:
        self._uow_factory = uow_factory
        self._clock = clock

    async def __call__(self, promotion_id: UUID, note: str) -> PromotionView:
        async with self._uow_factory() as uow:
            promotion = await uow.promotions.get(promotion_id)
            if promotion is None:
                raise PromotionNotFound()
            promotion.reject(note, self._clock.now())
            await uow.promotions.save(promotion)
            await uow.commit()
            return (await _views(uow, [promotion]))[0]


class EndPromotion:
    """El administrador deja de destacar un producto desde ya."""

    def __init__(self, uow_factory: UnitOfWorkFactory, clock: Clock) -> None:
        self._uow_factory = uow_factory
        self._clock = clock

    async def __call__(self, promotion_id: UUID) -> PromotionView:
        async with self._uow_factory() as uow:
            promotion = await uow.promotions.get(promotion_id)
            if promotion is None:
                raise PromotionNotFound()
            promotion.end(self._clock.now())
            await uow.promotions.save(promotion)
            await uow.commit()
            return (await _views(uow, [promotion]))[0]
