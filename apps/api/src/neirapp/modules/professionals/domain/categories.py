import re
import unicodedata
from dataclasses import dataclass, field

from neirapp.modules.professionals.domain.errors import (
    InvalidCategoryLabel,
    InvalidColor,
    InvalidIcon,
)

# Íconos que sabe dibujar el frontend (nombres de lucide-react).
ICONS = frozenset(
    {
        "Cog",
        "Stethoscope",
        "Scale",
        "GraduationCap",
        "Calculator",
        "Brain",
        "Ruler",
        "Laptop",
        "PawPrint",
        "Ellipsis",
    }
)
MAX_LABEL = 60
_COLOR = re.compile(r"^#[0-9a-fA-F]{6}$")


def slugify(text: str) -> str:
    """ "Ingeniería Civil" -> "ingenieria-civil" (el id que guardan los perfiles)."""
    plain = unicodedata.normalize("NFD", text).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", plain.lower()).strip("-")[:50]


def unique_slug(label: str, taken: set[str], fallback: str) -> str:
    base = slugify(label) or fallback
    slug, n = base, 2
    while slug in taken:
        slug, n = f"{base}-{n}", n + 1
    return slug


def clean_label(raw: str) -> str:
    label = " ".join(raw.split())
    if not 2 <= len(label) <= MAX_LABEL:
        raise InvalidCategoryLabel()
    return label


def clean_color(raw: str) -> str:
    if not _COLOR.match(raw.strip()):
        raise InvalidColor()
    return raw.strip().lower()


def clean_icon(raw: str) -> str:
    if raw not in ICONS:
        raise InvalidIcon()
    return raw


@dataclass
class Subcategory:
    id: str
    label: str
    color: str
    position: int = 0


@dataclass
class Category:
    """Área del directorio (Medicina, Derecho…) con sus especialidades. La gestiona el admin."""

    id: str
    label: str
    icon: str
    color: str
    position: int = 0
    subcategories: list[Subcategory] = field(default_factory=list)

    def find(self, subcategory_id: str) -> Subcategory | None:
        return next((s for s in self.subcategories if s.id == subcategory_id), None)
