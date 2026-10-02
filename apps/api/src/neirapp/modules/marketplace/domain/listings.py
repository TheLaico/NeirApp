import re
from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum
from uuid import UUID, uuid4

from neirapp.modules.marketplace.domain.errors import (
    InvalidListingDescription,
    InvalidListingPhotos,
    InvalidListingPrice,
    InvalidListingQuantity,
    InvalidListingTitle,
    InvalidSellerPhone,
)

MAX_TITLE = 80
MAX_DESCRIPTION = 1000
MAX_QUANTITY = 999
MAX_PRICE = 100_000_000_000  # Hasta 100 mil millones: hay fincas y edificios caros
MAX_PHOTOS = 8
MAX_LISTINGS_PER_SELLER = 30
# Solo fotos subidas a la app (POST /uploads/images): nombre aleatorio de 32 caracteres hex.
_UPLOADED = re.compile(r"^/api/v1/uploads/images/[0-9a-f]{32}\.(png|jpg|webp)$")


class ListingKind(StrEnum):
    SALE = "sale"
    RENT = "rent"


class RentPeriod(StrEnum):
    DAY = "day"
    WEEK = "week"
    MONTH = "month"


class ListingCategory(StrEnum):
    HOUSE = "house"  # Casas
    APARTMENT = "apartment"  # Apartamentos
    BUILDING = "building"  # Edificios
    COMMERCIAL = "commercial"  # Locales comerciales
    OFFICE = "office"  # Oficinas y consultorios
    FARM = "farm"  # Fincas y casas campestres
    LOT = "lot"  # Lotes y terrenos
    WAREHOUSE = "warehouse"  # Bodegas
    ROOM = "room"  # Habitaciones
    PARKING = "parking"  # Parqueaderos
    OTHER = "other"


def _clean(text: str) -> str:
    return " ".join(text.split())


def normalize_mobile(raw: str) -> str:
    """Celular colombiano: 10 dígitos que empiezan por 3. Acepta espacios, guiones y el +57."""
    digits = "".join(ch for ch in raw if ch.isdigit())
    if len(digits) == 12 and digits.startswith("57"):
        digits = digits[2:]
    if len(digits) != 10 or not digits.startswith("3"):
        raise InvalidSellerPhone()
    return digits


@dataclass(frozen=True)
class ListingData:
    """Lo que escribe el vendedor. Sin precio solo si lo negocia por chat."""

    title: str
    kind: ListingKind
    category: "ListingCategory"
    description: str
    quantity: int
    photos: list[str]
    whatsapp: str
    price_cop: int | None = None
    negotiable: bool = False
    rent_period: RentPeriod = RentPeriod.MONTH

    def cleaned(self) -> "ListingData":
        title = _clean(self.title)
        if not 3 <= len(title) <= MAX_TITLE:
            raise InvalidListingTitle()
        description = "\n".join(line.rstrip() for line in self.description.strip().splitlines())
        if not 10 <= len(description) <= MAX_DESCRIPTION:
            raise InvalidListingDescription()
        if not 1 <= self.quantity <= MAX_QUANTITY:
            raise InvalidListingQuantity()
        if self.price_cop is None and not self.negotiable:
            raise InvalidListingPrice()
        if self.price_cop is not None and not 1 <= self.price_cop <= MAX_PRICE:
            raise InvalidListingPrice()
        photos = [p.strip() for p in self.photos]
        if not 1 <= len(photos) <= MAX_PHOTOS or len(set(photos)) != len(photos):
            raise InvalidListingPhotos()
        if any(not _UPLOADED.match(p) for p in photos):
            raise InvalidListingPhotos()
        return ListingData(
            title=title,
            kind=self.kind,
            category=self.category,
            description=description,
            quantity=self.quantity,
            photos=photos,
            whatsapp=normalize_mobile(self.whatsapp),
            price_cop=self.price_cop,
            negotiable=self.negotiable,
            rent_period=self.rent_period if self.kind is ListingKind.RENT else RentPeriod.MONTH,
        )


@dataclass
class Listing:
    """Un inmueble que alguien ofrece en venta o alquiler. NeirAPP solo media: el trato y el pago
    se hacen por WhatsApp. Se ve mientras el vendedor la tenga activa, tenga el mes pagado y el
    equipo no la haya retirado."""

    id: UUID
    seller_id: UUID
    seller_name: str
    title: str
    kind: ListingKind
    category: ListingCategory
    description: str
    quantity: int
    whatsapp: str
    created_at: datetime
    updated_at: datetime
    price_cop: int | None = None
    negotiable: bool = False
    rent_period: RentPeriod = RentPeriod.MONTH
    photos: list[str] = field(default_factory=list)
    is_active: bool = True  # El vendedor la pausa (vendido, sin unidades, de viaje…)
    removed: bool = False  # La retiró el administrador (por un reporte)
    removed_note: str = ""
    paid_until: datetime | None = None

    @classmethod
    def create(
        cls, seller_id: UUID, seller_name: str, data: ListingData, now: datetime
    ) -> "Listing":
        listing = cls(
            id=uuid4(),
            seller_id=seller_id,
            seller_name=seller_name,
            title="",
            kind=data.kind,
            category=data.category,
            description="",
            quantity=1,
            whatsapp="",
            created_at=now,
            updated_at=now,
        )
        listing.update(data, now)
        return listing

    def update(self, data: ListingData, now: datetime) -> None:
        clean = data.cleaned()
        self.title = clean.title
        self.kind = clean.kind
        self.category = clean.category
        self.description = clean.description
        self.quantity = clean.quantity
        self.photos = clean.photos
        self.whatsapp = clean.whatsapp
        self.price_cop = clean.price_cop
        self.negotiable = clean.negotiable
        self.rent_period = clean.rent_period
        self.updated_at = now

    def is_paid(self, now: datetime) -> bool:
        return self.paid_until is not None and self.paid_until > now

    def is_public(self, now: datetime) -> bool:
        return self.is_active and not self.removed and self.is_paid(now)
