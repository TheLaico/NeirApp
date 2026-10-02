import re
from dataclasses import dataclass, field
from datetime import datetime, time
from enum import StrEnum
from uuid import UUID

from neirapp.modules.venues.domain.errors import (
    InvalidVenueCapacity,
    InvalidVenueDescription,
    InvalidVenueEmail,
    InvalidVenueLocation,
    InvalidVenueName,
    InvalidVenuePhone,
    InvalidVenuePhotos,
    InvalidVenuePrice,
    InvalidVenueSchedule,
    InvalidVenueText,
    InvalidVenueWhatsapp,
)

MAX_NAME = 80
MAX_TAGLINE = 100
MAX_DESCRIPTION = 1000
MAX_ADDRESS = 120
MAX_PHOTOS = 12
MAX_PRICE = 50_000_000
MAX_PEOPLE = 500
# Lo que abarca el mapa de Neira de la app (el pueblo y sus alrededores inmediatos).
LAT_RANGE = (5.1485, 5.1865)
LNG_RANGE = (-75.5445, -75.4985)
_UPLOADED = re.compile(r"^/api/v1/uploads/images/[0-9a-f]{32}\.(png|jpg|webp)$")
_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_TIME = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")


class VenueCategory(StrEnum):
    RESTAURANT = "restaurant"  # Restaurante
    CAFE = "cafe"  # Café o panadería
    BAR = "bar"  # Bar o discoteca
    SPORTS = "sports"  # Cancha o escenario deportivo
    EVENTS = "events"  # Salón de eventos
    RECREATION = "recreation"  # Centro recreativo, piscina, finca de recreo
    SPA = "spa"  # Spa o bienestar
    TOUR = "tour"  # Tour o experiencia
    OTHER = "other"


class Feature(StrEnum):
    WIFI = "wifi"
    PARKING = "parking"
    OUTDOOR = "outdoor"  # Zona al aire libre
    KIDS = "kids"  # Zona para niños
    PETS = "pets"  # Acepta mascotas
    ACCESSIBLE = "accessible"  # Acceso para silla de ruedas
    MUSIC = "music"  # Música en vivo
    AC = "ac"
    BAR = "bar"
    FOOD = "food"  # Comida
    VIEW = "view"  # Vista panorámica
    POOL = "pool"


class PriceUnit(StrEnum):
    PERSON = "person"  # Por persona
    HOUR = "hour"  # Por hora
    BOOKING = "booking"  # Por reserva / evento


def _clean(text: str, limit: int) -> str:
    text = " ".join(text.split())
    if len(text) > limit:
        raise InvalidVenueText()
    return text


def _digits(raw: str) -> str:
    digits = "".join(ch for ch in raw if ch.isdigit())
    if len(digits) == 12 and digits.startswith("57"):
        digits = digits[2:]
    return digits


def _phone(raw: str) -> str:
    digits = _digits(raw)
    if not 7 <= len(digits) <= 10:
        raise InvalidVenuePhone()
    return digits


def _whatsapp(raw: str) -> str:
    if not raw.strip():
        return ""
    digits = _digits(raw)
    if len(digits) != 10 or not digits.startswith("3"):
        raise InvalidVenueWhatsapp()
    return digits


def _time(raw: str) -> str:
    raw = raw.strip()
    if not _TIME.match(raw):
        raise InvalidVenueSchedule()
    return raw


def as_time(hhmm: str) -> time:
    hour, minute = hhmm.split(":")
    return time(int(hour), int(minute))


@dataclass(frozen=True)
class VenueData:
    """Lo que llena el establecimiento en su panel."""

    name: str
    category: VenueCategory
    description: str
    address: str
    lat: float
    lng: float
    phone: str
    photos: list[str]
    tagline: str = ""
    whatsapp: str = ""
    email: str = ""
    features: list[Feature] = field(default_factory=list)
    open_time: str = "08:00"
    close_time: str = "22:00"
    open_days: list[int] = field(default_factory=lambda: [0, 1, 2, 3, 4, 5, 6])
    max_people: int = 20
    price_cop: int = 0
    price_unit: PriceUnit = PriceUnit.PERSON
    is_listed: bool = True


@dataclass
class Venue:
    """Un lugar de Neira que recibe reservas (restaurante, cancha, salón de eventos…). Aparece en
    Reservas mientras su cuenta siga autorizada y no se oculte. El administrador decide cuáles son
    destacados y con qué imagen de fondo sale su banner."""

    user_id: UUID
    name: str
    category: VenueCategory
    description: str
    address: str
    lat: float
    lng: float
    phone: str
    created_at: datetime
    updated_at: datetime
    tagline: str = ""
    whatsapp: str = ""
    email: str = ""
    features: list[Feature] = field(default_factory=list)
    photos: list[str] = field(default_factory=list)
    open_time: str = "08:00"
    close_time: str = "22:00"
    open_days: list[int] = field(default_factory=lambda: [0, 1, 2, 3, 4, 5, 6])
    max_people: int = 20
    price_cop: int = 0  # 0: se consulta con el lugar
    price_unit: PriceUnit = PriceUnit.PERSON
    is_listed: bool = True
    # Los decide el administrador.
    is_featured: bool = False
    banner_url: str = ""

    @classmethod
    def create(cls, user_id: UUID, data: VenueData, now: datetime) -> "Venue":
        venue = cls(user_id, "", data.category, "", "", 0.0, 0.0, "", now, now)
        venue.update(data, now)
        return venue

    def update(self, data: VenueData, now: datetime) -> None:
        name = " ".join(data.name.split())
        if not 2 <= len(name) <= MAX_NAME:
            raise InvalidVenueName()
        description = data.description.strip()
        if not 20 <= len(description) <= MAX_DESCRIPTION:
            raise InvalidVenueDescription()
        if not (
            LAT_RANGE[0] <= data.lat <= LAT_RANGE[1] and LNG_RANGE[0] <= data.lng <= LNG_RANGE[1]
        ):
            raise InvalidVenueLocation()
        if not 0 <= data.price_cop <= MAX_PRICE:
            raise InvalidVenuePrice()
        if not 1 <= data.max_people <= MAX_PEOPLE:
            raise InvalidVenueCapacity()
        photos = [p.strip() for p in data.photos]
        if not 1 <= len(photos) <= MAX_PHOTOS or len(set(photos)) != len(photos):
            raise InvalidVenuePhotos()
        if any(not _UPLOADED.match(p) for p in photos):
            raise InvalidVenuePhotos()
        email = data.email.strip().lower()
        if email and not _EMAIL.match(email):
            raise InvalidVenueEmail()
        days = sorted(set(data.open_days))
        open_time, close_time = _time(data.open_time), _time(data.close_time)
        if not days or any(not 0 <= d <= 6 for d in days) or open_time == close_time:
            raise InvalidVenueSchedule()
        self.name = name
        self.category = data.category
        self.description = description
        self.address = _clean(data.address, MAX_ADDRESS)
        if not self.address:
            raise InvalidVenueText("Escribe la dirección o la vereda.")
        self.lat = round(data.lat, 6)
        self.lng = round(data.lng, 6)
        self.phone = _phone(data.phone)
        self.photos = photos
        self.tagline = _clean(data.tagline, MAX_TAGLINE)
        self.whatsapp = _whatsapp(data.whatsapp)
        self.email = email
        self.features = list(dict.fromkeys(data.features))
        self.open_time = open_time
        self.close_time = close_time
        self.open_days = days
        self.max_people = data.max_people
        self.price_cop = data.price_cop
        self.price_unit = data.price_unit
        self.is_listed = data.is_listed
        self.updated_at = now

    def is_open_at(self, weekday: int, at: time) -> bool:
        """¿Atiende ese día (0 = lunes) a esa hora? Si cierra después de medianoche (p. ej. un bar
        de 18:00 a 02:00), la madrugada cuenta como parte del día en que abrió."""
        start, end = as_time(self.open_time), as_time(self.close_time)
        if start < end:
            return weekday in self.open_days and start <= at < end
        if at >= start:
            return weekday in self.open_days
        return at < end and (weekday - 1) % 7 in self.open_days

    def set_featured(self, featured: bool, banner_url: str) -> None:
        banner_url = banner_url.strip()
        if banner_url and not _UPLOADED.match(banner_url):
            raise InvalidVenuePhotos("Sube la imagen del banner desde la app.")
        self.is_featured = featured
        self.banner_url = banner_url
