import re
from dataclasses import dataclass
from datetime import datetime
from uuid import UUID, uuid4

from neirapp.modules.leads.domain.errors import (
    InvalidApplicationDetails,
    InvalidApplicationRole,
    InvalidBusinessName,
    InvalidContactEmail,
    InvalidContactName,
    InvalidContactPhone,
    InvalidDocumentNumber,
    MissingCompanyName,
)

# Roles a los que alguien puede pedir entrar desde "¿Quieres formar parte de NeirAPP?". Son los
# mismos que el administrador autoriza por correo (identity ASSIGNABLE_ROLES); cliente es
# automático y administrador no se pide.
APPLICABLE_ROLES = frozenset(
    {"courier", "store_staff", "professional", "supplier", "hotel", "venue", "driver"}
)
# Para estos el negocio o la empresa es obligatorio; para los demás es opcional.
COMPANY_REQUIRED = frozenset({"store_staff", "supplier", "hotel", "venue"})

MAX_NAME = 80
MAX_COMPANY = 120
MAX_DETAIL_FIELDS = 12
MAX_DETAIL_KEY = 40
MAX_DETAIL_VALUE = 300
MAX_MESSAGE = 600
_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _clean(text: str) -> str:
    return " ".join(text.split())


def _digits(text: str) -> str:
    return "".join(ch for ch in text if ch.isdigit())


@dataclass
class RoleApplication:
    """Alguien (sin cuenta todavía, o con ella) pide formar parte de NeirAPP con un rol: repartidor,
    comerciante, profesional, proveedor, hotel, establecimiento o conductor. Deja quién es, cómo
    contactarlo y, si aplica, la empresa detrás; un administrador lo revisa y autoriza su correo."""

    id: UUID
    role: str
    full_name: str
    document_number: str
    phone: str
    email: str
    company_name: str
    company_id: str  # NIT, RNT u otro registro de la empresa (opcional)
    details: dict[str, str]  # Datos propios de cada rol (vehículo, placa, profesión, dirección…)
    message: str
    created_at: datetime
    is_contacted: bool = False

    @classmethod
    def create(
        cls,
        *,
        role: str,
        full_name: str,
        document_number: str,
        phone: str,
        email: str,
        company_name: str = "",
        company_id: str = "",
        details: dict[str, str] | None = None,
        message: str = "",
        now: datetime,
    ) -> "RoleApplication":
        if role not in APPLICABLE_ROLES:
            raise InvalidApplicationRole()
        full_name = _clean(full_name)
        if not 2 <= len(full_name) <= MAX_NAME:
            raise InvalidContactName()
        document = _digits(document_number)
        if not 5 <= len(document) <= 15:
            raise InvalidDocumentNumber()
        if not 7 <= len(_digits(phone)) <= 15:
            raise InvalidContactPhone()
        email = email.strip().lower()
        if not _EMAIL.match(email) or len(email) > 254:
            raise InvalidContactEmail()
        company_name = _clean(company_name)
        if role in COMPANY_REQUIRED and not company_name:
            raise MissingCompanyName()
        if company_name and not 2 <= len(company_name) <= MAX_COMPANY:
            raise InvalidBusinessName()
        company_id = _clean(company_id)
        if len(company_id) > 40:
            raise InvalidApplicationDetails()
        clean_details: dict[str, str] = {}
        for key, value in (details or {}).items():
            key, value = _clean(str(key)), _clean(str(value))
            if not value:
                continue
            if len(key) > MAX_DETAIL_KEY or len(value) > MAX_DETAIL_VALUE:
                raise InvalidApplicationDetails()
            clean_details[key] = value
        if len(clean_details) > MAX_DETAIL_FIELDS:
            raise InvalidApplicationDetails()
        message = message.strip()
        if len(message) > MAX_MESSAGE:
            raise InvalidApplicationDetails()
        return cls(
            id=uuid4(),
            role=role,
            full_name=full_name,
            document_number=document,
            phone=_clean(phone)[:32],
            email=email,
            company_name=company_name,
            company_id=company_id,
            details=clean_details,
            message=message,
            created_at=now,
        )
