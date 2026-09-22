from uuid import UUID

from pydantic import BaseModel, Field

from neirapp.modules.stores.application.dto import ProductWithStore
from neirapp.modules.stores.domain.entities import Product, Store, StoreCategory


class CreateStoreRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    category: StoreCategory
    description: str = Field(default="", max_length=500)
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)


class UpdateStoreRequest(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    category: StoreCategory | None = None
    description: str | None = Field(default=None, max_length=500)


class SetStoreOpenRequest(BaseModel):
    is_open: bool


class StoreResponse(BaseModel):
    id: UUID
    owner_user_id: UUID
    name: str
    category: StoreCategory
    description: str
    lat: float
    lng: float
    is_open: bool

    @classmethod
    def from_domain(cls, store: Store) -> "StoreResponse":
        return cls(
            id=store.id,
            owner_user_id=store.owner_user_id,
            name=store.name,
            category=store.category,
            description=store.description,
            lat=store.lat,
            lng=store.lng,
            is_open=store.is_open,
        )


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
    def from_domain(cls, result: ProductWithStore) -> "SearchResultResponse":
        return cls(
            product=ProductResponse.from_domain(result.product),
            store=StoreResponse.from_domain(result.store),
        )
