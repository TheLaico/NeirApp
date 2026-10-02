import re
from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum
from uuid import UUID

from neirapp.modules.lodging.domain.errors import (
    InvalidHotelDescription,
    InvalidHotelEmail,
    InvalidHotelLocation,
    InvalidHotelName,
    InvalidHotelPhone,
    InvalidHotelPhotos,
    InvalidHotelPrice,
    InvalidHotelText,
    InvalidHotelWhatsapp,
)

MAX_NAME = 80
MAX_TAGLINE = 100
MAX_DESCRIPTION = 1000
MAX_ADDRESS = 120
MAX_PHOTOS = 12
MAX_PRICE = 50_000_000
# Lo que abarca el mapa de Neira de la app (el pueblo y sus alrededores inmediatos): un hospedaje
# por fuera no se podría ver en "Ver mapa".
LAT_RANGE = (5.1485, 5.1865)
LNG_RANGE = (-75.5445, -75.4985)
_UPLOADED = re.compile(r"^/api/v1/uploads/images/[0-9a-f]{32}\.(png|jpg|webp)$")
_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_TIME = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")


class HotelKind(StrEnum):
    HOTEL = "hotel"
    FARM = "farm"  # Finca hotel
    HOSTEL = "hostel"  # Hostal
    CABIN = "cabin"  # Cabañas
    GLAMPING = "glamping"
    HOUSE = "house"  # Casa o apartamento turístico


class Amenity(StrEnum):
    WIFI = "wifi"
    POOL = "pool"
    RESTAURANT = "restaurant"
    PARKING = "parking"
    BREAKFAST = "breakfast"
    BAR = "bar"
    VIEW = "view"  # Vista panorámica
    CAMPING = "camping"  # Zona de camping
    AC = "ac"
    TV = "tv"
    PETS = "pets"  # Acepta mascotas
    JACUZZI = "jacuzzi"
    BBQ = "bbq"
    LAUNDRY = "laundry"


def _clean(text: str, limit: int) -> str:
    text = " ".join(text.split())
    if len(text) > limit:
        raise InvalidHotelText()
    return text


def _phone(raw: str) -> str:
    digits = "".join(ch for ch in raw if ch.isdigit())
    if len(digits) == 12 and digits.startswith("57"):
        digits = digits[2:]
    if not 7 <= len(digits) <= 10:
        raise InvalidHotelPhone()
    return digits


def _whatsapp(raw: str) -> str:
    if not raw.strip():
        return ""
    digits = "".join(ch for ch in raw if ch.isdigit())
    if len(digits) == 12 and digits.startswith("57"):
        digits = digits[2:]
    if len(digits) != 10 or not digits.startswith("3"):
        raise InvalidHotelWhatsapp()
    return digits


def _time(raw: str, default: str) -> str:
    raw = raw.strip() or default
    if not _TIME.match(raw):
        raise InvalidHotelText()
    return raw


@dataclass(frozen=True)
class HotelData:
    """Lo que llena el hospedaje en su panel."""

    name: str
    kind: HotelKind
    description: str
    address: str
    lat: float
    lng: float
    phone: str
    price_from_cop: int
    photos: list[str]
    tagline: str = ""
    whatsapp: str = ""
    email: str = ""
    amenities: list[Amenity] = field(default_factory=list)
    check_in: str = "15:00"
    check_out: str = "12:00"
    is_listed: bool = True


@dataclass
class Hotel:
    """Un hospedaje de Neira (hotel, finca hotel, hostal, cabañas…). Aparece en Hospedaje mientras
    tenga el mes pagado ($ 25.000), su cuenta siga autorizada y no se oculte. Con el plan Destacado
    ($ 4.900 al mes) sale en "Hoteles recomendados"; el administrador elige el fondo del banner."""

    user_id: UUID
    name: str
    kind: HotelKind
    description: str
    address: str
    lat: float
    lng: float
    phone: str
    price_from_cop: int
    created_at: datetime
    updated_at: datetime
    tagline: str = ""
    whatsapp: str = ""
    email: str = ""
    amenities: list[Amenity] = field(default_factory=list)
    photos: list[str] = field(default_factory=list)
    check_in: str = "15:00"
    check_out: str = "12:00"
    is_listed: bool = True
    # Hasta cuándo tiene pagado aparecer y destacarse (los confirma el administrador).
    paid_until: datetime | None = None
    featured_until: datetime | None = None
    # Lo elige el administrador desde su panel.
    banner_url: str = ""

    @classmethod
    def create(cls, user_id: UUID, data: HotelData, now: datetime) -> "Hotel":
        hotel = cls(user_id, "", data.kind, "", "", 0.0, 0.0, "", 0, now, now)
        hotel.update(data, now)
        return hotel

    def update(self, data: HotelData, now: datetime) -> None:
        name = " ".join(data.name.split())
        if not 2 <= len(name) <= MAX_NAME:
            raise InvalidHotelName()
        description = data.description.strip()
        if not 20 <= len(description) <= MAX_DESCRIPTION:
            raise InvalidHotelDescription()
        if not (
            LAT_RANGE[0] <= data.lat <= LAT_RANGE[1] and LNG_RANGE[0] <= data.lng <= LNG_RANGE[1]
        ):
            raise InvalidHotelLocation()
        if not 1 <= data.price_from_cop <= MAX_PRICE:
            raise InvalidHotelPrice()
        photos = [p.strip() for p in data.photos]
        if not 1 <= len(photos) <= MAX_PHOTOS or len(set(photos)) != len(photos):
            raise InvalidHotelPhotos()
        if any(not _UPLOADED.match(p) for p in photos):
            raise InvalidHotelPhotos()
        email = data.email.strip().lower()
        if email and not _EMAIL.match(email):
            raise InvalidHotelEmail()
        self.name = name
        self.kind = data.kind
        self.description = description
        self.address = _clean(data.address, MAX_ADDRESS)
        if not self.address:
            raise InvalidHotelText("Escribe la dirección o la vereda.")
        self.lat = round(data.lat, 6)
        self.lng = round(data.lng, 6)
        self.phone = _phone(data.phone)
        self.price_from_cop = data.price_from_cop
        self.photos = photos
        self.tagline = _clean(data.tagline, MAX_TAGLINE)
        self.whatsapp = _whatsapp(data.whatsapp)
        self.email = email
        self.amenities = list(dict.fromkeys(data.amenities))  # sin repetidos, en su orden
        self.check_in = _time(data.check_in, "15:00")
        self.check_out = _time(data.check_out, "12:00")
        self.is_listed = data.is_listed
        self.updated_at = now

    def is_paid(self, now: datetime) -> bool:
        return self.paid_until is not None and self.paid_until > now

    def is_public(self, now: datetime) -> bool:
        return self.is_listed and self.is_paid(now)

    def is_featured(self, now: datetime) -> bool:
        """Sale en "Hoteles recomendados": tiene el plan Destacado y además aparece."""
        return self.featured_until is not None and self.featured_until > now and self.is_paid(now)

    def set_banner(self, banner_url: str) -> None:
        banner_url = banner_url.strip()
        if banner_url and not _UPLOADED.match(banner_url):
            raise InvalidHotelPhotos("Sube la imagen del banner desde la app.")
        self.banner_url = banner_url
