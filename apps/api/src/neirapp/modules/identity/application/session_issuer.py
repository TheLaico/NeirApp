import hashlib
import secrets
from datetime import datetime, timedelta
from uuid import UUID, uuid4

from neirapp.modules.identity.application.dto import TokenPair
from neirapp.modules.identity.application.ports import TokenService, UnitOfWork
from neirapp.modules.identity.domain.entities import RefreshToken, User


def hash_refresh_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


class SessionIssuer:
    """Emite un access token (JWT corto) y un refresh token opaco que se guarda hasheado."""

    def __init__(self, tokens: TokenService, refresh_ttl: timedelta) -> None:
        self._tokens = tokens
        self._refresh_ttl = refresh_ttl

    async def issue(
        self, uow: UnitOfWork, user: User, now: datetime, family_id: UUID | None = None
    ) -> TokenPair:
        access = self._tokens.issue_access_token(user.id, frozenset(user.roles), now)
        raw_refresh = secrets.token_urlsafe(48)
        await uow.refresh_tokens.add(
            RefreshToken(
                id=uuid4(),
                user_id=user.id,
                family_id=family_id or uuid4(),
                token_hash=hash_refresh_token(raw_refresh),
                created_at=now,
                expires_at=now + self._refresh_ttl,
            )
        )
        return TokenPair(access.token, raw_refresh, access.expires_in)
