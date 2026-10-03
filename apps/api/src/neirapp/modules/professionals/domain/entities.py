import re
from dataclasses import dataclass, field
from datetime import datetime
from uuid import UUID

from neirapp.modules.professionals.domain.errors import (
    InvalidCategory,
    InvalidContactEmail,
    InvalidExperience,
    InvalidFullName,
    InvalidPhone,
    InvalidPhotoUrl,
    InvalidTitle,
    NoModality,
    TextTooLong,
)

TITLES = frozenset({"", "Dr.", "Dra.", "Ing.", "Abg.", "Arq.", "Lic.", "Psic.", "Cont."})
MAX_NAME = 80
MAX_HEADLINE = 90
MAX_DESCRIPTION = 600
MAX_ADDRESS = 120
MAX_SCHEDULE = 120
MAX_EMAIL = 320
MAX_EXPERIENCE = 70

# Las categorías se gestionan como identificadores cortos ("medicina", "medicina-general").
_SLUG = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
_EMAIL = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
_UPLOADED_IMAGE_PREFIX = "/api/v1/uploads/images/"


def _clean(text: str) -> str:
    return " ".join(text.split())


def _limited(text: str, limit: int, *, multiline: bool = False) -> str:
    # La descripción conserva sus saltos de línea; el resto se deja en una sola línea.
    value = text.strip() if multiline else _clean(text)
    if len(value) > limit:
        raise TextTooLong()
    return value


def normalize_mobile(raw: str) -> str:
    """Celular colombiano: 10 dígitos que empiezan por 3. Acepta espacios, guiones y el +57."""
    digits = "".join(ch for ch in raw if ch.isdigit())
    if len(digits) == 12 and digits.startswith("57"):
        digits = digits[2:]
    if len(digits) != 10 or not digits.startswith("3"):
        raise InvalidPhone()
    return digits


def _slug(raw: str, *, required: bool) -> str:
    value = raw.strip()
    if not value:
        if required:
            raise InvalidCategory()
        return ""
    if len(value) > 60 or not _SLUG.match(value):
        raise InvalidCategory()
    return value


@dataclass(frozen=True)
class Modalities:
    office: bool = True
    home: bool = False
    online: bool = False


@dataclass(frozen=True)
class ProfileData:
    """Lo que el profesional escribe en "Mi perfil" (sin validar)."""

    full_name: str
    category_id: str
    phone: str
    title: str = ""
    headline: str = ""
    subcategory_id: str = ""
    experience_years: int | None = None
    description: str = ""
    whatsapp: str = ""
    email: str = ""
    address: str = ""
    schedule: str = ""
    modalities: Modalities = field(default_factory=Modalities)
    is_available: bool = True
    photo_url: str = ""


@dataclass
class ProfessionalProfile:
    """Perfil público de un profesional autorizado. Lo arma él mismo; hay uno por cuenta."""

    user_id: UUID
    full_name: str
    category_id: str
    phone: str
    created_at: datetime
    updated_at: datetime
    title: str = ""
    headline: str = ""
    subcategory_id: str = ""
    experience_years: int | None = None
    description: str = ""
    whatsapp: str = ""
    email: str = ""
    address: str = ""
    schedule: str = ""
    modalities: Modalities = field(default_factory=Modalities)
    is_available: bool = True
    photo_url: str = ""
    # Lo marca el administrador: aparece primero en su especialidad.
    is_featured: bool = False
    # Ajustes del profesional (Configuración): pausar el perfil en el directorio sin borrar nada.
    is_listed: bool = True

    @classmethod
    def create(cls, user_id: UUID, data: ProfileData, now: datetime) -> "ProfessionalProfile":
        profile = cls(
            user_id=user_id,
            full_name="",
            category_id="",
            phone="",
            created_at=now,
            updated_at=now,
        )
        profile.update(data, now)
        return profile

    def update(self, data: ProfileData, now: datetime) -> None:
        """Reemplaza los datos del perfil, validándolos. No toca `is_featured`."""
        full_name = _clean(data.full_name)
        if not 3 <= len(full_name) <= MAX_NAME:
            raise InvalidFullName()
        if data.title not in TITLES:
            raise InvalidTitle()
        if data.experience_years is not None and not 0 <= data.experience_years <= MAX_EXPERIENCE:
            raise InvalidExperience()
        email = data.email.strip().lower()
        if email and (len(email) > MAX_EMAIL or not _EMAIL.match(email)):
            raise InvalidContactEmail()
        modalities = data.modalities
        if not (modalities.office or modalities.home or modalities.online):
            raise NoModality()
        photo_url = data.photo_url.strip()
        if photo_url and not photo_url.startswith(_UPLOADED_IMAGE_PREFIX):
            raise InvalidPhotoUrl()

        self.full_name = full_name
        self.title = data.title
        self.headline = _limited(data.headline, MAX_HEADLINE)
        self.category_id = _slug(data.category_id, required=True)
        self.subcategory_id = _slug(data.subcategory_id, required=False)
        self.experience_years = data.experience_years
        self.description = _limited(data.description, MAX_DESCRIPTION, multiline=True)
        self.phone = normalize_mobile(data.phone)
        self.whatsapp = normalize_mobile(data.whatsapp) if data.whatsapp.strip() else ""
        self.email = email
        self.address = _limited(data.address, MAX_ADDRESS)
        self.schedule = _limited(data.schedule, MAX_SCHEDULE)
        self.modalities = modalities
        self.is_available = data.is_available
        self.photo_url = photo_url
        self.updated_at = now

    @property
    def display_name(self) -> str:
        return f"{self.title} {self.full_name}".strip()
