from uuid import UUID

from neirapp.modules.identity.application.dto import AuthenticatedSession, ProfileView, TermsPolicy
from neirapp.modules.identity.application.ports import PasswordHasher, UnitOfWorkFactory
from neirapp.modules.identity.application.session_issuer import SessionIssuer, hash_refresh_token
from neirapp.modules.identity.application.terms import has_accepted_current_terms
from neirapp.modules.identity.domain.errors import (
    InactiveAccount,
    InvalidCredentials,
    InvalidToken,
    SamePassword,
    UserNotFound,
    WrongCurrentPassword,
)
from neirapp.modules.identity.domain.value_objects import canonical_email, validate_password
from neirapp.shared.application.ports import Clock


class Login:
    def __init__(
        self,
        uow_factory: UnitOfWorkFactory,
        hasher: PasswordHasher,
        sessions: SessionIssuer,
        policy: TermsPolicy,
        clock: Clock,
    ) -> None:
        self._uow_factory = uow_factory
        self._hasher = hasher
        self._sessions = sessions
        self._policy = policy
        self._clock = clock

    async def __call__(self, email: str, password: str) -> AuthenticatedSession:
        async with self._uow_factory() as uow:
            user = await uow.users.get_by_email(canonical_email(email))
            if user is None:
                await self._hasher.verify_dummy(password)
                raise InvalidCredentials()
            if not await self._hasher.verify(user.password_hash, password):
                raise InvalidCredentials()
            if not user.is_active:
                raise InactiveAccount()

            tokens = await self._sessions.issue(uow, user, self._clock.now())
            must_accept = not await has_accepted_current_terms(uow, user.id, self._policy)
            await uow.commit()

        return AuthenticatedSession(ProfileView(user, must_accept), tokens)


class RefreshSession:
    """Rota el refresh token. Reusar uno ya rotado indica robo: se revoca toda la cadena."""

    def __init__(
        self,
        uow_factory: UnitOfWorkFactory,
        sessions: SessionIssuer,
        policy: TermsPolicy,
        clock: Clock,
    ) -> None:
        self._uow_factory = uow_factory
        self._sessions = sessions
        self._policy = policy
        self._clock = clock

    async def __call__(self, raw_refresh_token: str) -> AuthenticatedSession:
        now = self._clock.now()
        async with self._uow_factory() as uow:
            stored = await uow.refresh_tokens.get_by_hash(hash_refresh_token(raw_refresh_token))
            if stored is None:
                raise InvalidToken()
            if stored.is_revoked:
                await uow.refresh_tokens.revoke_family(stored.family_id, now)
                await uow.commit()
                raise InvalidToken()
            if stored.is_expired(now):
                raise InvalidToken()

            user = await uow.users.get(stored.user_id)
            if user is None or not user.is_active:
                raise InvalidToken()

            stored.revoke(now)
            await uow.refresh_tokens.update(stored)
            tokens = await self._sessions.issue(uow, user, now, family_id=stored.family_id)
            must_accept = not await has_accepted_current_terms(uow, user.id, self._policy)
            await uow.commit()

        return AuthenticatedSession(ProfileView(user, must_accept), tokens)


class Logout:
    """Cierra la sesión revocando la cadena del refresh token. Es idempotente."""

    def __init__(self, uow_factory: UnitOfWorkFactory, clock: Clock) -> None:
        self._uow_factory = uow_factory
        self._clock = clock

    async def __call__(self, raw_refresh_token: str) -> None:
        async with self._uow_factory() as uow:
            stored = await uow.refresh_tokens.get_by_hash(hash_refresh_token(raw_refresh_token))
            if stored is not None:
                await uow.refresh_tokens.revoke_family(stored.family_id, self._clock.now())
                await uow.commit()


class ChangePassword:
    """Cambia la contraseña tras confirmar la actual. Cierra las demás sesiones abiertas y
    entrega una nueva para que quien la cambió siga conectado en este dispositivo."""

    def __init__(
        self,
        uow_factory: UnitOfWorkFactory,
        hasher: PasswordHasher,
        sessions: SessionIssuer,
        policy: TermsPolicy,
        clock: Clock,
    ) -> None:
        self._uow_factory = uow_factory
        self._hasher = hasher
        self._sessions = sessions
        self._policy = policy
        self._clock = clock

    async def __call__(
        self, user_id: UUID, current_password: str, new_password: str
    ) -> AuthenticatedSession:
        now = self._clock.now()
        async with self._uow_factory() as uow:
            user = await uow.users.get(user_id)
            if user is None:
                raise UserNotFound()
            if not await self._hasher.verify(user.password_hash, current_password):
                raise WrongCurrentPassword()
            validate_password(new_password)
            if new_password == current_password:
                raise SamePassword()

            user.password_hash = await self._hasher.hash(new_password)
            await uow.users.update(user)
            await uow.refresh_tokens.revoke_all_for_user(user.id, now)
            tokens = await self._sessions.issue(uow, user, now)
            must_accept = not await has_accepted_current_terms(uow, user.id, self._policy)
            await uow.commit()

        return AuthenticatedSession(ProfileView(user, must_accept), tokens)
