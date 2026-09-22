from datetime import UTC, datetime, timedelta

import pytest

from neirapp.modules.identity.domain.entities import RefreshToken, Role, User
from neirapp.modules.identity.domain.errors import (
    InvalidEmail,
    InvalidFullName,
    InvalidPhone,
    WeakPassword,
)
from neirapp.modules.identity.domain.value_objects import (
    canonical_email,
    normalize_email,
    normalize_full_name,
    normalize_phone,
    validate_password,
)

NOW = datetime(2026, 9, 21, 12, 0, tzinfo=UTC)


@pytest.mark.parametrize(
    "raw",
    ["3001234567", "300 123 4567", "+57 300 123 4567", "573001234567", "(300) 123-4567"],
)
def test_normalize_phone_acepta_formatos_colombianos(raw: str) -> None:
    assert normalize_phone(raw) == "+573001234567"


@pytest.mark.parametrize(
    "raw", ["", "123", "2001234567", "30012345678", "abc3001234567", "+1 555 123 4567"]
)
def test_normalize_phone_rechaza_lo_que_no_es_celular_colombiano(raw: str) -> None:
    with pytest.raises(InvalidPhone):
        normalize_phone(raw)


def test_normalize_email_pasa_a_minusculas() -> None:
    assert normalize_email("  Ana@Correo.COM ") == "ana@correo.com"
    assert canonical_email("  Ana@Correo.COM ") == "ana@correo.com"


@pytest.mark.parametrize("raw", ["", "sin-arroba", "a@b", "a b@c.com"])
def test_normalize_email_rechaza_invalidos(raw: str) -> None:
    with pytest.raises(InvalidEmail):
        normalize_email(raw)


def test_normalize_full_name_colapsa_espacios_y_valida_largo() -> None:
    assert normalize_full_name("  Ana   María  ") == "Ana María"
    with pytest.raises(InvalidFullName):
        normalize_full_name(" a ")


def test_validate_password_largo() -> None:
    validate_password("12345678")
    with pytest.raises(WeakPassword):
        validate_password("1234567")
    with pytest.raises(WeakPassword):
        validate_password("x" * 129)


def test_usuario_nuevo_es_cliente_y_esta_activo() -> None:
    user = User.register(
        email="Ana@Correo.com", password_hash="h", full_name="Ana", phone="300 123 4567", now=NOW
    )
    assert user.roles == {Role.CUSTOMER}
    assert user.is_active
    assert user.email == "ana@correo.com"
    assert user.phone == "+573001234567"


def test_grant_role_y_has_any_role() -> None:
    user = User.register(
        email="a@b.co", password_hash="h", full_name="Ana", phone="3001234567", now=NOW
    )
    assert not user.has_any_role(Role.ADMIN, Role.COURIER)
    user.grant_role(Role.COURIER)
    assert user.has_any_role(Role.ADMIN, Role.COURIER)


def test_refresh_token_expiracion_y_revocacion() -> None:
    from uuid import uuid4

    token = RefreshToken(
        id=uuid4(),
        user_id=uuid4(),
        family_id=uuid4(),
        token_hash="x",
        created_at=NOW,
        expires_at=NOW + timedelta(days=1),
    )
    assert not token.is_expired(NOW)
    assert token.is_expired(NOW + timedelta(days=1))
    token.revoke(NOW)
    first = token.revoked_at
    token.revoke(NOW + timedelta(hours=1))
    assert token.is_revoked and token.revoked_at == first
