"""Normalización y validación de datos de contacto. Puro Python, sin dependencias externas."""

import re

from neirapp.modules.identity.domain.errors import (
    InvalidEmail,
    InvalidFullName,
    InvalidPhone,
    WeakPassword,
)

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_CO_MOBILE_RE = re.compile(r"^3\d{9}$")

PASSWORD_MIN_LENGTH = 8
PASSWORD_MAX_LENGTH = 128


def canonical_email(raw: str) -> str:
    """Forma canónica para comparar y buscar correos (sin validar)."""
    return raw.strip().lower()


def normalize_email(raw: str) -> str:
    email = canonical_email(raw)
    if len(email) > 320 or not _EMAIL_RE.match(email):
        raise InvalidEmail()
    return email


def normalize_phone(raw: str) -> str:
    """Devuelve un celular colombiano en formato E.164 (+573001234567)."""
    digits = re.sub(r"[\s\-().]", "", raw)
    if digits.startswith("+57"):
        digits = digits[3:]
    elif digits.startswith("57") and len(digits) == 12:
        digits = digits[2:]
    if not _CO_MOBILE_RE.match(digits):
        raise InvalidPhone()
    return f"+57{digits}"


def normalize_full_name(raw: str) -> str:
    name = " ".join(raw.split())
    if not 2 <= len(name) <= 120:
        raise InvalidFullName()
    return name


def validate_password(raw: str) -> None:
    if not PASSWORD_MIN_LENGTH <= len(raw) <= PASSWORD_MAX_LENGTH:
        raise WeakPassword()
