from datetime import date, datetime, time
from uuid import UUID

from pydantic import BaseModel, Field

from neirapp.modules.stores.application.dto import ProductWithStore
from neirapp.modules.stores.domain.entities import Product, Store, StoreCategory
from neirapp.modules.stores.domain.schedule import ClosedReason, local_time


class CreateStoreRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    category: StoreCategory
    description: str = Field(default="", max_length=500)
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)


class AdminCreateStoreRequest(CreateStoreRequest):
    owner_email: str = Field(description="Correo del comerciante que será dueño de la tienda.")


class UpdateStoreRequest(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    category: StoreCategory | None = None
    description: str | None = Field(default=None, max_length=500)
    image_url: str | None = Field(
        default=None, max_length=2048, description='Foto del local; "" la quita.'
    )
    logo_url: str | None = Field(
        default=None, max_length=2048, description='Logo o ícono de la marca; "" lo quita.'
    )


class SetStoreOpenRequest(BaseModel):
    is_open: bool


class SetStoreApprovalRequest(BaseModel):
    is_approved: bool


class DayHoursSchema(BaseModel):
    weekday: int = Field(ge=0, le=6, description="0 = lunes … 6 = domingo")
    is_open: bool
    opens: time | None = None
    closes: time | None = None
    all_day: bool = False


class UpdateScheduleRequest(BaseModel):
    days: list[DayHoursSchema] = Field(min_length=7, max_length=7)


class ClosedDateRequest(BaseModel):
    day: date
    reason: str = Field(default="", max_length=120)


class ClosedDateSchema(BaseModel):
    day: date
    reason: str


class ScheduleResponse(BaseModel):
    """Horario de la tienda y si está abierta ahora (hora de Colombia)."""

    timezone: str
    has_hours: bool
    is_24_7: bool
    days: list[DayHoursSchema]
    closed_dates: list[ClosedDateSchema]
    is_open: bool
    is_open_manual: bool
    closed_reason: ClosedReason | None
    next_open_at: datetime | None

    @classmethod
    def from_domain(cls, now: datetime, store: Store) -> "ScheduleResponse":
        today = local_time(now).date()
        return cls(
            timezone="America/Bogota",
            has_hours=store.schedule.has_hours,
            is_24_7=store.schedule.is_24_7,
            days=[DayHoursSchema(**vars(d)) for d in store.schedule.days],
            closed_dates=[
                ClosedDateSchema(day=c.day, reason=c.reason)
                for c in store.schedule.closed_dates
                if c.day >= today
            ],
            is_open=store.is_open_now(now),
            is_open_manual=store.is_open,
            closed_reason=store.closed_reason(now),
            next_open_at=store.next_open_at(now),
        )


class StoreResponse(BaseModel):
    id: UUID
    owner_user_id: UUID
    name: str
    category: StoreCategory
    description: str
    lat: float
    lng: float
    is_open: bool  # abierta ahora: interruptor + horario + fechas de cierre
    is_open_manual: bool  # solo el interruptor del comerciante
    closed_reason: ClosedReason | None
    next_open_at: datetime | None
    is_approved: bool
    is_rejected: bool
    image_url: str | None
    logo_url: str | None
    recommended_position: int | None
    is_listed: bool

    @classmethod
    def from_domain(cls, now: datetime, store: Store) -> "StoreResponse":
        return cls(
            id=store.id,
            owner_user_id=store.owner_user_id,
            name=store.name,
            category=store.category,
            description=store.description,
            lat=store.lat,
            lng=store.lng,
            is_open=store.is_open_now(now),
            is_open_manual=store.is_open,
            closed_reason=store.closed_reason(now),
            next_open_at=store.next_open_at(now),
            is_approved=store.is_approved,
            is_rejected=store.is_rejected,
            image_url=store.image_url,
            logo_url=store.logo_url,
            recommended_position=store.recommended_position,
            is_listed=store.is_listed,
        )


class AdminStoreResponse(StoreResponse):
    """Lo que ve el administrador: además, el correo de quien es dueño de la tienda."""

    owner_email: str = ""


class AdminUpdateStoreRequest(BaseModel):
    owner_email: str | None = Field(default=None, description="Correo del nuevo dueño.")
    lat: float | None = Field(default=None, ge=-90, le=90)
    lng: float | None = Field(default=None, ge=-180, le=180)
    is_listed: bool | None = Field(default=None, description="¿Aparece en el mapa y la búsqueda?")


class SetRecommendedStoresRequest(BaseModel):
    store_ids: list[UUID] = Field(max_length=100)


class CreateProductRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    description: str = Field(default="", max_length=500)
    price_cop: int = Field(gt=0, le=50_000_000)
    image_url: str | None = Field(default=None, max_length=2048)


class UpdateProductRequest(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    description: str | None = Field(default=None, max_length=500)
    price_cop: int | None = Field(default=None, gt=0, le=50_000_000)
    image_url: str | None = Field(default=None, max_length=2048)


class SetProductAvailabilityRequest(BaseModel):
    is_available: bool


class ProductResponse(BaseModel):
    id: UUID
    store_id: UUID
    name: str
    description: str
    price_cop: int
    image_url: str | None
    is_available: bool

    @classmethod
    def from_domain(cls, product: Product) -> "ProductResponse":
        return cls(
            id=product.id,
            store_id=product.store_id,
            name=product.name,
            description=product.description,
            price_cop=product.price_cop,
            image_url=product.image_url,
            is_available=product.is_available,
        )


class SearchResultResponse(BaseModel):
    product: ProductResponse
    store: StoreResponse

    @classmethod
    def from_domain(cls, now: datetime, result: ProductWithStore) -> "SearchResultResponse":
        return cls(
            product=ProductResponse.from_domain(result.product),
            store=StoreResponse.from_domain(now, result.store),
        )
