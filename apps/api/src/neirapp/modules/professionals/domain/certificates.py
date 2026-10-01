import re
from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from uuid import UUID, uuid4

from neirapp.modules.professionals.domain.errors import (
    InvalidCertificateFile,
    InvalidCertificateTitle,
    InvalidCertificateYear,
    MissingReviewNote,
    TextTooLong,
)

MAX_CERTIFICATES = 20
MAX_TITLE = 100
MAX_ISSUER = 100
MIN_YEAR = 1950
# Un PDF de /uploads/documents o una foto de /uploads/images (nombres aleatorios de 32 hex).
_FILE = re.compile(
    r"^/api/v1/uploads/(documents/[0-9a-f]{32}\.pdf|images/[0-9a-f]{32}\.(png|jpg|webp))$"
)


class CertificateKind(StrEnum):
    DEGREE = "degree"  # Título profesional
    LICENSE = "license"  # Tarjeta o registro profesional
    SPECIALIZATION = "specialization"  # Especialización, maestría…
    COURSE = "course"  # Curso o diplomado
    OTHER = "other"


class CertificateStatus(StrEnum):
    PENDING = "pending"  # Lo revisa el equipo de NeirAPP
    VERIFIED = "verified"
    REJECTED = "rejected"


@dataclass(frozen=True)
class CertificateData:
    """Lo que el profesional escribe al agregar o editar un certificado (sin validar)."""

    kind: CertificateKind
    title: str
    file_url: str
    issuer: str = ""
    year: int | None = None
    show_on_profile: bool = True


@dataclass
class Certificate:
    """Un título, tarjeta profesional o curso del profesional. El admin lo revisa; los clientes
    solo ven los verificados que el profesional decida mostrar."""

    id: UUID
    user_id: UUID
    kind: CertificateKind
    title: str
    issuer: str
    year: int | None
    file_url: str
    show_on_profile: bool
    status: CertificateStatus
    review_note: str
    created_at: datetime
    updated_at: datetime
    reviewed_at: datetime | None = None

    @classmethod
    def create(cls, user_id: UUID, data: CertificateData, now: datetime) -> "Certificate":
        certificate = cls(
            id=uuid4(),
            user_id=user_id,
            kind=data.kind,
            title="",
            issuer="",
            year=None,
            file_url="",
            show_on_profile=True,
            status=CertificateStatus.PENDING,
            review_note="",
            created_at=now,
            updated_at=now,
        )
        certificate.update(data, now)
        return certificate

    def update(self, data: CertificateData, now: datetime) -> None:
        """Reemplaza los datos. Si cambia lo que se revisó (tipo, nombre, institución, año o
        archivo), vuelve a quedar en revisión; cambiar solo si se muestra en el perfil no."""
        title = " ".join(data.title.split())
        if not 3 <= len(title) <= MAX_TITLE:
            raise InvalidCertificateTitle()
        issuer = " ".join(data.issuer.split())
        if len(issuer) > MAX_ISSUER:
            raise TextTooLong()
        if data.year is not None and not MIN_YEAR <= data.year <= now.year + 1:
            raise InvalidCertificateYear()
        file_url = data.file_url.strip()
        if not _FILE.match(file_url):
            raise InvalidCertificateFile()

        reviewed = (self.kind, self.title, self.issuer, self.year, self.file_url)
        self.kind = data.kind
        self.title = title
        self.issuer = issuer
        self.year = data.year
        self.file_url = file_url
        self.show_on_profile = data.show_on_profile
        self.updated_at = now
        if reviewed != (self.kind, self.title, self.issuer, self.year, self.file_url):
            self.status = CertificateStatus.PENDING
            self.review_note = ""
            self.reviewed_at = None

    def review(self, *, approve: bool, note: str, now: datetime) -> None:
        note = " ".join(note.split())
        if not approve and not 5 <= len(note) <= 200:
            raise MissingReviewNote()
        self.status = CertificateStatus.VERIFIED if approve else CertificateStatus.REJECTED
        self.review_note = "" if approve else note
        self.reviewed_at = now

    @property
    def is_public(self) -> bool:
        return self.status is CertificateStatus.VERIFIED and self.show_on_profile
