import re
from dataclasses import dataclass
from datetime import datetime, timedelta
from uuid import UUID

from neirapp.modules.rides.domain.errors import (
    InvalidDriverName,
    InvalidDriverPhone,
    InvalidDriverPhoto,
    InvalidLocation,
    InvalidPlate,
    InvalidVehicle,
)
from neirapp.modules.rides.domain.geo import in_neira

MAX_CAPACITY = 3  # Un motocarro lleva hasta 3 pasajeros
_PLATE = re.compile(r"^[A-Z0-9]{5,7}$")
_UPLOADED = re.compile(r"^/api/v1/uploads/images/[0-9a-f]{32}\.(png|jpg|webp)$")
# Si el conductor no reporta su ubicación en este tiempo, deja de verse en el mapa.
LOCATION_FRESH = timedelta(minutes=2)


def _photo(url: str) -> str:
    url = url.strip()
    if url and not _UPLOADED.match(url):
        raise InvalidDriverPhoto()
    return url


def mobile(raw: str) -> str:
    digits = "".join(ch for ch in raw if ch.isdigit())
    if len(digits) == 12 and digits.startswith("57"):
        digits = digits[2:]
    return digits


@dataclass(frozen=True)
class DriverData:
    name: str
    phone: str
    plate: str
    vehicle_model: str = ""
    model_year: int = 0
    color: str = ""
    capacity: int = MAX_CAPACITY
    photo_url: str = ""
    vehicle_photo_url: str = ""


@dataclass
class Driver:
    """Un conductor de motocarro con su vehículo. Recibe solicitudes mientras esté disponible, y su
    última ubicación se muestra en el mapa (a los clientes, sin datos personales)."""

    user_id: UUID
    name: str
    phone: str
    plate: str
    created_at: datetime
    updated_at: datetime
    vehicle_model: str = ""
    model_year: int = 0
    color: str = ""
    capacity: int = MAX_CAPACITY
    photo_url: str = ""
    vehicle_photo_url: str = ""
    is_online: bool = False
    lat: float | None = None
    lng: float | None = None
    located_at: datetime | None = None

    @classmethod
    def create(cls, user_id: UUID, data: DriverData, now: datetime) -> "Driver":
        driver = cls(user_id, "", "", "", now, now)
        driver.update(data, now)
        return driver

    def update(self, data: DriverData, now: datetime) -> None:
        name = " ".join(data.name.split())
        if not 2 <= len(name) <= 80:
            raise InvalidDriverName()
        phone = mobile(data.phone)
        if len(phone) != 10 or not phone.startswith("3"):
            raise InvalidDriverPhone()
        plate = re.sub(r"[\s-]", "", data.plate).upper()
        if not _PLATE.match(plate):
            raise InvalidPlate()
        model = " ".join(data.vehicle_model.split())
        color = " ".join(data.color.split())
        year_ok = data.model_year == 0 or 1980 <= data.model_year <= now.year + 1
        if len(model) > 60 or len(color) > 30 or not year_ok:
            raise InvalidVehicle()
        if not 1 <= data.capacity <= MAX_CAPACITY:
            raise InvalidVehicle()
        self.name = name
        self.phone = phone
        self.plate = plate
        self.vehicle_model = model
        self.model_year = data.model_year
        self.color = color
        self.capacity = data.capacity
        self.photo_url = _photo(data.photo_url)
        self.vehicle_photo_url = _photo(data.vehicle_photo_url)
        self.updated_at = now

    @property
    def plate_label(self) -> str:
        """ "NEI123" → "NEI-123" (como se lee en la placa)."""
        p = self.plate
        return f"{p[:3]}-{p[3:]}" if len(p) == 6 and p[:3].isalpha() else p

    def locate(self, lat: float, lng: float, now: datetime) -> None:
        if not in_neira(lat, lng):
            raise InvalidLocation()
        self.lat = round(lat, 6)
        self.lng = round(lng, 6)
        self.located_at = now

    def has_fresh_location(self, now: datetime) -> bool:
        return self.located_at is not None and now - self.located_at <= LOCATION_FRESH
