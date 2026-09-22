from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime
from types import TracebackType
from typing import Protocol, Self
from uuid import UUID

from neirapp.modules.identity.domain.entities import (
    RefreshToken,
    Role,
    TermsAcceptance,
    TermsDocument,
    User,
)


class UserRepository(Protocol):
    async def add(self, user: User) -> None:
        """Persiste un usuario nuevo. Lanza `EmailAlreadyRegistered` si el correo ya existe."""
        ...

    async def get(self, user_id: UUID) -> User | None: ...

    async def get_by_email(self, email: str) -> User | None: ...

    async def update(self, user: User) -> None: ...


class TermsRepository(Protocol):
    async def add(self, acceptance: TermsAcceptance) -> None: ...

    async def has_accepted(self, user_id: UUID, document: TermsDocument, version: str) -> bool: ...


class RefreshTokenRepository(Protocol):
    async def add(self, token: RefreshToken) -> None: ...

    async def get_by_hash(self, token_hash: str) -> RefreshToken | None: ...

    async def update(self, token: RefreshToken) -> None: ...

    async def revoke_family(self, family_id: UUID, now: datetime) -> None: ...


class UnitOfWork(Protocol):
    """Una transacción: todo lo que se hace dentro se confirma o se descarta junto."""

    @property
    def users(self) -> UserRepository: ...

    @property
    def terms(self) -> TermsRepository: ...

    @property
    def refresh_tokens(self) -> RefreshTokenRepository: ...

    async def __aenter__(self) -> Self: ...

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        tb: TracebackType | None,
    ) -> None: ...

    async def commit(self) -> None: ...

    async def rollback(self) -> None: ...


UnitOfWorkFactory = Callable[[], UnitOfWork]


class PasswordHasher(Protocol):
    async def hash(self, plain: str) -> str: ...

    async def verify(self, password_hash: str, plain: str) -> bool: ...

    async def verify_dummy(self, plain: str) -> None:
        """Gasta el mismo tiempo que `verify` para no revelar si un correo existe."""
        ...


@dataclass(frozen=True)
class AccessToken:
    token: str
    expires_in: int  # segundos


@dataclass(frozen=True)
class AccessClaims:
    user_id: UUID
    roles: frozenset[Role]


class TokenService(Protocol):
    def issue_access_token(
        self, user_id: UUID, roles: frozenset[Role], now: datetime
    ) -> AccessToken: ...

    def decode_access_token(self, token: str, now: datetime) -> AccessClaims:
        """Lanza `InvalidToken` si el token es inválido o expiró."""
        ...
