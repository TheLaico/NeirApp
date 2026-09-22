from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from uuid import UUID, uuid4

from neirapp.modules.stores.domain.errors import (
    InvalidPrice,
    InvalidProductName,
    InvalidStoreName,
    OutsideServiceArea,
)
from neirapp.modules.stores.domain.geofence import is_within_neira

MAX_PRICE_COP = 50_000_000  # tope de cordura: un domicilio de barrio, no una compra mayor


class StoreCategory(StrEnum):
    """Coincide con los íconos y colores de marcadores definidos en la identidad visual."""

    GENERAL = "general"
    RESTAURANT = "restaurant"
    SUPERMARKET = "supermarket"
    PHARMACY = "pharmacy"
    BAKERY = "bakery"
    CAFE = "cafe"


def _normalize_name(raw: str, error: type[InvalidStoreName | InvalidProductName]) -> str:
    name = " ".join(raw.split())
    if not 2 <= len(name) <= 120:
        raise error()
    return name


def validate_price_cop(price_cop: int) -> None:
    if not 0 < price_cop <= MAX_PRICE_COP:
        raise InvalidPrice()


@dataclass
class Store:
    id: UUID
    owner_user_id: UUID
    name: str
    category: StoreCategory
    description: str
    lat: float
    lng: float
    is_open: bool
    created_at: datetime

    @classmethod
    def create(
        cls,
        *,
        owner_user_id: UUID,
        name: str,
        category: StoreCategory,
        description: str,
        lat: float,
        lng: float,
        now: datetime,
    ) -> "Store":
        if not is_within_neira(lat, lng):
            raise OutsideServiceArea()
        return cls(
            id=uuid4(),
            owner_user_id=owner_user_id,
            name=_normalize_name(name, InvalidStoreName),
            category=category,
            description=description.strip()[:500],
            lat=lat,
            lng=lng,
            is_open=True,
            created_at=now,
        )

    def is_owned_by(self, user_id: UUID) -> bool:
        return self.owner_user_id == user_id

    def update_profile(
        self,
        *,
        name: str | None = None,
        category: StoreCategory | None = None,
        description: str | None = None,
    ) -> None:
        if name is not None:
            self.name = _normalize_name(name, InvalidStoreName)
        if category is not None:
            self.category = category
        if description is not None:
            self.description = description.strip()[:500]

    def relocate(self, *, lat: float, lng: float) -> None:
        if not is_within_neira(lat, lng):
            raise OutsideServiceArea()
        self.lat = lat
        self.lng = lng

    def set_open(self, is_open: bool) -> None:
        self.is_open = is_open


@dataclass
class Product:
    id: UUID
    store_id: UUID
    name: str
    description: str
    price_cop: int
    image_url: str | None
    is_available: bool
    created_at: datetime

    @classmethod
    def create(
        cls,
        *,
        store_id: UUID,
        name: str,
        description: str,
        price_cop: int,
        image_url: str | None,
        now: datetime,
    ) -> "Product":
        validate_price_cop(price_cop)
        return cls(
            id=uuid4(),
            store_id=store_id,
            name=_normalize_name(name, InvalidProductName),
            description=description.strip()[:500],
            price_cop=price_cop,
            image_url=image_url,
            is_available=True,
            created_at=now,
        )

    def update(
        self,
        *,
        name: str | None = None,
        description: str | None = None,
        price_cop: int | None = None,
        image_url: str | None = None,
    ) -> None:
        if name is not None:
            self.name = _normalize_name(name, InvalidProductName)
        if description is not None:
            self.description = description.strip()[:500]
        if price_cop is not None:
            validate_price_cop(price_cop)
            self.price_cop = price_cop
        if image_url is not None:
            self.image_url = image_url

    def set_available(self, is_available: bool) -> None:
        self.is_available = is_available
