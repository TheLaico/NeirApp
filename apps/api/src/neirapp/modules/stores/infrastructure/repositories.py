from collections.abc import Callable
from uuid import UUID

from sqlalchemy import ColumnElement, asc, case, delete, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from neirapp.modules.stores.domain.entities import Product, Store, StoreCategory
from neirapp.modules.stores.domain.schedule import ClosedDate, DayHours, StoreSchedule
from neirapp.modules.stores.infrastructure.models import (
    StoreClosedDateModel,
    StoreHoursModel,
    StoreModel,
    StoreProductModel,
)


def _to_schedule(model: StoreModel) -> StoreSchedule:
    return StoreSchedule(
        days=sorted(
            (DayHours(h.weekday, h.is_open, h.opens, h.closes, h.all_day) for h in model.hours),
            key=lambda d: d.weekday,
        ),
        closed_dates=sorted(
            (ClosedDate(c.day, c.reason) for c in model.closed_dates), key=lambda c: c.day
        ),
    )


def _sync_schedule(model: StoreModel, schedule: StoreSchedule) -> None:
    """Iguala las filas de horario y de cierres a las de la entidad, sin borrar y reinsertar
    la misma clave en un solo `flush`."""
    hours = {h.weekday: h for h in model.hours}
    wanted = {d.weekday: d for d in schedule.days}
    model.hours = [h for h in model.hours if h.weekday in wanted]
    for weekday, day in wanted.items():
        if weekday in hours:
            row = hours[weekday]
            row.is_open, row.opens, row.closes, row.all_day = (
                day.is_open,
                day.opens,
                day.closes,
                day.all_day,
            )
        else:
            model.hours.append(
                StoreHoursModel(
                    store_id=model.id,
                    weekday=weekday,
                    is_open=day.is_open,
                    opens=day.opens,
                    closes=day.closes,
                    all_day=day.all_day,
                )
            )
    dates = {c.day: c for c in model.closed_dates}
    wanted_dates = {c.day: c for c in schedule.closed_dates}
    model.closed_dates = [c for c in model.closed_dates if c.day in wanted_dates]
    for date_, closed in wanted_dates.items():
        if date_ in dates:
            dates[date_].reason = closed.reason
        else:
            model.closed_dates.append(
                StoreClosedDateModel(store_id=model.id, day=date_, reason=closed.reason)
            )


def _to_store(model: StoreModel) -> Store:
    return Store(
        id=model.id,
        owner_user_id=model.owner_user_id,
        name=model.name,
        category=StoreCategory(model.category),
        description=model.description,
        lat=model.lat,
        lng=model.lng,
        is_open=model.is_open,
        is_approved=model.is_approved,
        is_rejected=model.is_rejected,
        created_at=model.created_at,
        image_url=model.image_url,
        recommended_position=model.recommended_position,
        is_listed=model.is_listed,
        schedule=_to_schedule(model),
    )


def _to_product(model: StoreProductModel) -> Product:
    return Product(
        id=model.id,
        store_id=model.store_id,
        name=model.name,
        description=model.description,
        price_cop=model.price_cop,
        image_url=model.image_url,
        is_available=model.is_available,
        created_at=model.created_at,
    )


class SqlAlchemyStoreRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, store: Store) -> None:
        self._session.add(
            StoreModel(
                id=store.id,
                owner_user_id=store.owner_user_id,
                name=store.name,
                category=store.category.value,
                description=store.description,
                lat=store.lat,
                lng=store.lng,
                is_open=store.is_open,
                is_approved=store.is_approved,
                is_rejected=store.is_rejected,
                image_url=store.image_url,
                created_at=store.created_at,
            )
        )
        await self._session.flush()

    async def get(self, store_id: UUID) -> Store | None:
        model = await self._session.get(StoreModel, store_id)
        return _to_store(model) if model else None

    async def get_by_owner(self, owner_user_id: UUID) -> Store | None:
        result = await self._session.execute(
            select(StoreModel).where(StoreModel.owner_user_id == owner_user_id).limit(1)
        )
        model = result.scalar_one_or_none()
        return _to_store(model) if model else None

    async def list_all(
        self,
        *,
        category: StoreCategory | None = None,
        is_approved: bool | None = None,
        is_listed: bool | None = None,
    ) -> list[Store]:
        stmt = select(StoreModel).order_by(StoreModel.created_at.desc())
        if is_listed is not None:
            stmt = stmt.where(StoreModel.is_listed == is_listed)
        if category is not None:
            stmt = stmt.where(StoreModel.category == category.value)
        if is_approved is not None:
            stmt = stmt.where(StoreModel.is_approved == is_approved)
            if is_approved is False:
                # "Pendientes" = todavía sin revisar. Sin este filtro, una tienda rechazada
                # (is_approved=False, is_rejected=True) nunca saldría de la cola del backoffice.
                stmt = stmt.where(StoreModel.is_rejected.is_(False))
        result = await self._session.execute(stmt)
        return [_to_store(m) for m in result.scalars()]

    async def update(self, store: Store) -> None:
        model = await self._session.get(StoreModel, store.id)
        if model is None:
            raise LookupError(f"Tienda {store.id} no existe")
        model.name = store.name
        model.category = store.category.value
        model.description = store.description
        model.lat = store.lat
        model.lng = store.lng
        model.is_open = store.is_open
        model.is_approved = store.is_approved
        model.is_rejected = store.is_rejected
        model.image_url = store.image_url
        model.recommended_position = store.recommended_position
        model.is_listed = store.is_listed
        model.owner_user_id = store.owner_user_id
        model.lat = store.lat
        model.lng = store.lng
        _sync_schedule(model, store.schedule)
        await self._session.flush()


_SORTS: dict[str, Callable[[], ColumnElement[object]]] = {
    "price_asc": lambda: asc(StoreProductModel.price_cop),
    "price_desc": lambda: desc(StoreProductModel.price_cop),
}


def _relevance_score(query_lower: str, needle: str) -> ColumnElement[int]:
    """Ordena por dónde coincidió la búsqueda, no solo si coincidió: nombre exacto > nombre
    empieza así > nombre de la tienda coincide > nombre contiene > tienda contiene > solo la
    descripción contiene. Es una heurística simple (no tsvector/pg_trgm, ver el roadmap Fase 4
    original) pero ya no es un orden alfabético disfrazado de "relevancia"."""
    return case(
        (func.lower(StoreProductModel.name) == query_lower, 5),
        (func.lower(StoreProductModel.name).like(f"{query_lower}%"), 4),
        (func.lower(StoreModel.name) == query_lower, 3),
        (func.lower(StoreModel.name).like(f"{query_lower}%"), 3),
        (func.lower(StoreProductModel.name).like(needle), 2),
        (func.lower(StoreModel.name).like(needle), 1),
        else_=0,
    )


class SqlAlchemyProductRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, product: Product) -> None:
        self._session.add(
            StoreProductModel(
                id=product.id,
                store_id=product.store_id,
                name=product.name,
                description=product.description,
                price_cop=product.price_cop,
                image_url=product.image_url,
                is_available=product.is_available,
                created_at=product.created_at,
            )
        )
        await self._session.flush()

    async def get(self, product_id: UUID) -> Product | None:
        model = await self._session.get(StoreProductModel, product_id)
        return _to_product(model) if model else None

    async def list_by_store(self, store_id: UUID, *, only_available: bool = False) -> list[Product]:
        stmt = (
            select(StoreProductModel)
            .where(StoreProductModel.store_id == store_id)
            .order_by(StoreProductModel.name)
        )
        if only_available:
            stmt = stmt.where(StoreProductModel.is_available)
        result = await self._session.execute(stmt)
        return [_to_product(m) for m in result.scalars()]

    async def search(
        self,
        query: str,
        *,
        category: StoreCategory | None = None,
        max_price_cop: int | None = None,
        sort: str = "relevance",
        limit: int = 50,
    ) -> list[tuple[Product, Store]]:
        # LIKE simple y portable (SQLite en tests, Postgres en prod). Cuando haga falta tolerar
        # errores de tipeo y sinónimos, esto se reemplaza por tsvector+pg_trgm o un motor dedicado
        # (ver roadmap Fase 4 original) detrás de este mismo método, sin tocar el resto del módulo.
        query_lower = query.strip().lower()
        needle = f"%{query_lower}%"
        stmt = (
            select(StoreProductModel, StoreModel)
            .join(StoreModel, StoreModel.id == StoreProductModel.store_id)
            .where(
                StoreProductModel.is_available,
                StoreModel.is_approved,
                StoreModel.is_listed,
                or_(
                    func.lower(StoreProductModel.name).like(needle),
                    func.lower(StoreProductModel.description).like(needle),
                    # El nombre de la tienda también cuenta: quien busca "Pizzeria Napoli" debe
                    # encontrar su catálogo aunque ningún producto se llame así.
                    func.lower(StoreModel.name).like(needle),
                ),
            )
        )
        if category is not None:
            stmt = stmt.where(StoreModel.category == category.value)
        if max_price_cop is not None:
            stmt = stmt.where(StoreProductModel.price_cop <= max_price_cop)

        if sort in _SORTS:
            stmt = stmt.order_by(_SORTS[sort]())
        else:
            stmt = stmt.order_by(
                desc(_relevance_score(query_lower, needle)), asc(StoreProductModel.name)
            )
        stmt = stmt.limit(limit)

        result = await self._session.execute(stmt)
        return [(_to_product(p), _to_store(s)) for p, s in result.all()]

    async def update(self, product: Product) -> None:
        model = await self._session.get(StoreProductModel, product.id)
        if model is None:
            raise LookupError(f"Producto {product.id} no existe")
        model.name = product.name
        model.description = product.description
        model.price_cop = product.price_cop
        model.image_url = product.image_url
        model.is_available = product.is_available
        await self._session.flush()

    async def delete(self, product_id: UUID) -> None:
        await self._session.execute(
            delete(StoreProductModel).where(StoreProductModel.id == product_id)
        )
