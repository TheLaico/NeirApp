from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum
from uuid import UUID, uuid4

from neirapp.modules.identity.domain.value_objects import (
    normalize_email,
    normalize_full_name,
    normalize_phone,
)


class Role(StrEnum):
    CUSTOMER = "customer"
    COURIER = "courier"
    STORE_STAFF = "store_staff"
    ADMIN = "admin"


class TermsDocument(StrEnum):
    TERMS_AND_CONDITIONS = "terms_and_conditions"
    PRIVACY_POLICY = "privacy_policy"


@dataclass
class User:
    id: UUID
    email: str
    password_hash: str
    full_name: str
    phone: str
    created_at: datetime
    roles: set[Role] = field(default_factory=set)
    is_active: bool = True

    @classmethod
    def register(
        cls, *, email: str, password_hash: str, full_name: str, phone: str, now: datetime
    ) -> "User":
        """Todo usuario nuevo es cliente; otros roles se otorgan por flujos propios (KYC, admin)."""
        return cls(
            id=uuid4(),
            email=normalize_email(email),
            password_hash=password_hash,
            full_name=normalize_full_name(full_name),
            phone=normalize_phone(phone),
            created_at=now,
            roles={Role.CUSTOMER},
        )

    def update_profile(self, *, full_name: str | None = None, phone: str | None = None) -> None:
        if full_name is not None:
            self.full_name = normalize_full_name(full_name)
        if phone is not None:
            self.phone = normalize_phone(phone)

    def grant_role(self, role: Role) -> None:
        self.roles.add(role)

    def has_any_role(self, *roles: Role) -> bool:
        return bool(self.roles.intersection(roles))


@dataclass(frozen=True)
class TermsAcceptance:
    id: UUID
    user_id: UUID
    document: TermsDocument
    version: str
    accepted_at: datetime
    ip_address: str | None

    @classmethod
    def create(
        cls,
        *,
        user_id: UUID,
        document: TermsDocument,
        version: str,
        accepted_at: datetime,
        ip_address: str | None,
    ) -> "TermsAcceptance":
        return cls(uuid4(), user_id, document, version, accepted_at, ip_address)


@dataclass
class RefreshToken:
    """Refresh token opaco. Solo se guarda su hash; `family_id` agrupa la cadena de rotaciones."""

    id: UUID
    user_id: UUID
    family_id: UUID
    token_hash: str
    created_at: datetime
    expires_at: datetime
    revoked_at: datetime | None = None

    def revoke(self, now: datetime) -> None:
        if self.revoked_at is None:
            self.revoked_at = now

    @property
    def is_revoked(self) -> bool:
        return self.revoked_at is not None

    def is_expired(self, now: datetime) -> bool:
        return self.expires_at <= now
