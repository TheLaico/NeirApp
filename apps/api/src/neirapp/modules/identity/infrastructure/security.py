import asyncio
from datetime import datetime, timedelta
from uuid import UUID

import jwt
from argon2 import PasswordHasher as Argon2
from argon2.exceptions import InvalidHashError, VerificationError

from neirapp.modules.identity.application.ports import AccessClaims, AccessToken
from neirapp.modules.identity.domain.entities import Role
from neirapp.modules.identity.domain.errors import InvalidToken


class Argon2PasswordHasher:
    """Argon2id. Es intensivo en CPU, así que corre en un hilo para no bloquear el event loop."""

    def __init__(self) -> None:
        self._argon2 = Argon2()
        self._dummy_hash = self._argon2.hash("neirapp-dummy-password")

    async def hash(self, plain: str) -> str:
        return await asyncio.to_thread(self._argon2.hash, plain)

    async def verify(self, password_hash: str, plain: str) -> bool:
        return await asyncio.to_thread(self._verify, password_hash, plain)

    async def verify_dummy(self, plain: str) -> None:
        await asyncio.to_thread(self._verify, self._dummy_hash, plain)

    def _verify(self, password_hash: str, plain: str) -> bool:
        try:
            return self._argon2.verify(password_hash, plain)
        except (VerificationError, InvalidHashError):
            return False


class JwtTokenService:
    ALGORITHM = "HS256"

    def __init__(self, secret: str, issuer: str, access_ttl: timedelta) -> None:
        self._secret = secret
        self._issuer = issuer
        self._access_ttl = access_ttl

    def issue_access_token(
        self, user_id: UUID, roles: frozenset[Role], now: datetime
    ) -> AccessToken:
        payload = {
            "iss": self._issuer,
            "sub": str(user_id),
            "roles": sorted(r.value for r in roles),
            "iat": int(now.timestamp()),
            "exp": int((now + self._access_ttl).timestamp()),
            "typ": "access",
        }
        token = jwt.encode(payload, self._secret, algorithm=self.ALGORITHM)
        return AccessToken(token, int(self._access_ttl.total_seconds()))

    def decode_access_token(self, token: str, now: datetime) -> AccessClaims:
        try:
            # `now` viene del reloj inyectado, así que la expiración se valida a mano.
            payload = jwt.decode(
                token,
                self._secret,
                algorithms=[self.ALGORITHM],
                issuer=self._issuer,
                options={"verify_exp": False, "require": ["exp", "sub", "iss"]},
            )
            if payload.get("typ") != "access" or int(payload["exp"]) <= int(now.timestamp()):
                raise InvalidToken()
            return AccessClaims(
                user_id=UUID(payload["sub"]),
                roles=frozenset(Role(r) for r in payload.get("roles", [])),
            )
        except (jwt.PyJWTError, ValueError, KeyError) as exc:
            raise InvalidToken() from exc
