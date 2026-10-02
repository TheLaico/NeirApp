import re
from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from uuid import UUID

from neirapp.modules.suppliers.domain.errors import (
    InvalidCompanyName,
    InvalidSupplierDescription,
    InvalidSupplierEmail,
    InvalidSupplierImage,
    InvalidSupplierLink,
    InvalidSupplierPhone,
    InvalidSupplierText,
    InvalidSupplierWhatsapp,
)

MAX_NAME = 80
MAX_TAGLINE = 80
MAX_DESCRIPTION = 400
MAX_ADDRESS = 120
# Solo imágenes subidas a la app (POST /uploads/images): nombre aleatorio de 32 caracteres hex.
_UPLOADED = re.compile(r"^/api/v1/uploads/images/[0-9a-f]{32}\.(png|jpg|webp)$")
_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_HANDLE = re.compile(r"^@?([A-Za-z0-9._]{1,60})$")
_URL = re.compile(r"^https?://[^\s]{3,200}$")


class SupplierCategory(StrEnum):
    FOOD = "food"  # Alimentos y bebidas
    CLEANING = "cleaning"  # Aseo y limpieza
    CONSTRUCTION = "construction"  # Construcción
    HARDWARE = "hardware"  # Ferretería
    CLOTHING = "clothing"  # Ropa y calzado
    TECHNOLOGY = "technology"  # Tecnología
    AGRO = "agro"  # Agro e insumos
    STATIONERY = "stationery"  # Papelería y oficina
    HEALTH = "health"  # Salud y belleza
    HOME = "home"  # Hogar y decoración
    PACKAGING = "packaging"  # Empaques y desechables
    OTHER = "other"


def _clean(text: str, limit: int) -> str:
    text = " ".join(text.split())
    if len(text) > limit:
        raise InvalidSupplierText()
    return text


def _phone(raw: str) -> str:
    digits = "".join(ch for ch in raw if ch.isdigit())
    if len(digits) == 12 and digits.startswith("57"):
        digits = digits[2:]
    if not 7 <= len(digits) <= 10:
        raise InvalidSupplierPhone()
    return digits


def _whatsapp(raw: str) -> str:
    if not raw.strip():
        return ""
    digits = "".join(ch for ch in raw if ch.isdigit())
    if len(digits) == 12 and digits.startswith("57"):
        digits = digits[2:]
    if len(digits) != 10 or not digits.startswith("3"):
        raise InvalidSupplierWhatsapp()
    return digits


def _social(raw: str, domain: str) -> str:
    """Acepta el enlace completo o solo el usuario ("@empresa") y guarda el enlace."""
    raw = raw.strip()
    if not raw:
        return ""
    if _URL.match(raw):
        if domain not in raw.lower():
            raise InvalidSupplierLink()
        return raw
    handle = _HANDLE.match(raw)
    if handle is None:
        raise InvalidSupplierLink()
    return f"https://www.{domain}/{handle.group(1)}"


def _website(raw: str) -> str:
    raw = raw.strip()
    if not raw:
        return ""
    if not raw.startswith(("http://", "https://")):
        raw = f"https://{raw}"
    if not _URL.match(raw):
        raise InvalidSupplierLink()
    return raw


def _image(raw: str) -> str:
    raw = raw.strip()
    if raw and not _UPLOADED.match(raw):
        raise InvalidSupplierImage()
    return raw


@dataclass(frozen=True)
class SupplierData:
    """Lo que llena la empresa. Logo, portada y catálogo (una imagen tipo brochure) son
    opcionales."""

    company_name: str
    category: SupplierCategory
    description: str
    phone: str
    tagline: str = ""
    whatsapp: str = ""
    email: str = ""
    address: str = ""
    website: str = ""
    facebook: str = ""
    instagram: str = ""
    logo_url: str = ""
    cover_url: str = ""
    catalog_url: str = ""
    is_listed: bool = True


@dataclass
class Supplier:
    """Una empresa de Neira que vende al por mayor. NeirAPP solo le da visibilidad: no hay carrito;
    los clientes la contactan por teléfono, WhatsApp o redes y ven su catálogo."""

    user_id: UUID
    company_name: str
    category: SupplierCategory
    description: str
    phone: str
    created_at: datetime
    updated_at: datetime
    tagline: str = ""
    whatsapp: str = ""
    email: str = ""
    address: str = ""
    website: str = ""
    facebook: str = ""
    instagram: str = ""
    logo_url: str = ""
    cover_url: str = ""
    catalog_url: str = ""
    is_listed: bool = True
    # Hasta cuándo tiene pagada la suscripción (la confirma el administrador). Sin pagar no aparece.
    paid_until: datetime | None = None

    @classmethod
    def create(cls, user_id: UUID, data: SupplierData, now: datetime) -> "Supplier":
        supplier = cls(user_id, "", data.category, "", "", now, now)
        supplier.update(data, now)
        return supplier

    def update(self, data: SupplierData, now: datetime) -> None:
        name = " ".join(data.company_name.split())
        if not 2 <= len(name) <= MAX_NAME:
            raise InvalidCompanyName()
        description = data.description.strip()
        if not 20 <= len(description) <= MAX_DESCRIPTION:
            raise InvalidSupplierDescription()
        email = data.email.strip().lower()
        if email and not _EMAIL.match(email):
            raise InvalidSupplierEmail()
        self.company_name = name
        self.category = data.category
        self.description = description
        self.phone = _phone(data.phone)
        self.tagline = _clean(data.tagline, MAX_TAGLINE)
        self.whatsapp = _whatsapp(data.whatsapp)
        self.email = email
        self.address = _clean(data.address, MAX_ADDRESS)
        self.website = _website(data.website)
        self.facebook = _social(data.facebook, "facebook.com")
        self.instagram = _social(data.instagram, "instagram.com")
        self.logo_url = _image(data.logo_url)
        self.cover_url = _image(data.cover_url)
        self.catalog_url = _image(data.catalog_url)
        self.is_listed = data.is_listed
        self.updated_at = now

    def is_paid(self, now: datetime) -> bool:
        return self.paid_until is not None and self.paid_until > now

    def is_public(self, now: datetime) -> bool:
        return self.is_listed and self.is_paid(now)
