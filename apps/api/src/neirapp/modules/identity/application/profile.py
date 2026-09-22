from uuid import UUID

from neirapp.modules.identity.application.dto import ProfileView, TermsPolicy
from neirapp.modules.identity.application.ports import (
    TokenService,
    UnitOfWork,
    UnitOfWorkFactory,
)
from neirapp.modules.identity.application.terms import has_accepted_current_terms
from neirapp.modules.identity.domain.entities import TermsAcceptance, TermsDocument, User
from neirapp.modules.identity.domain.errors import (
    InactiveAccount,
    TermsVersionMismatch,
    UserNotFound,
)
from neirapp.shared.application.ports import Clock


class AuthenticateAccessToken:
    """Resuelve el usuario dueño de un access token. Rechaza cuentas desactivadas."""

    def __init__(self, uow_factory: UnitOfWorkFactory, tokens: TokenService, clock: Clock) -> None:
        self._uow_factory = uow_factory
        self._tokens = tokens
        self._clock = clock

    async def __call__(self, token: str) -> User:
        claims = self._tokens.decode_access_token(token, self._clock.now())
        async with self._uow_factory() as uow:
            user = await uow.users.get(claims.user_id)
        if user is None:
            raise UserNotFound()
        if not user.is_active:
            raise InactiveAccount()
        return user


async def _load(uow: UnitOfWork, user_id: UUID) -> User:
    user = await uow.users.get(user_id)
    if user is None:
        raise UserNotFound()
    return user


class GetProfile:
    def __init__(self, uow_factory: UnitOfWorkFactory, policy: TermsPolicy) -> None:
        self._uow_factory = uow_factory
        self._policy = policy

    async def __call__(self, user_id: UUID) -> ProfileView:
        async with self._uow_factory() as uow:
            user = await _load(uow, user_id)
            must_accept = not await has_accepted_current_terms(uow, user_id, self._policy)
        return ProfileView(user, must_accept)


class UpdateProfile:
    def __init__(self, uow_factory: UnitOfWorkFactory, policy: TermsPolicy) -> None:
        self._uow_factory = uow_factory
        self._policy = policy

    async def __call__(
        self, user_id: UUID, *, full_name: str | None = None, phone: str | None = None
    ) -> ProfileView:
        async with self._uow_factory() as uow:
            user = await _load(uow, user_id)
            user.update_profile(full_name=full_name, phone=phone)
            await uow.users.update(user)
            must_accept = not await has_accepted_current_terms(uow, user_id, self._policy)
            await uow.commit()
        return ProfileView(user, must_accept)


class AcceptTerms:
    """Registra la aceptación de una versión vigente (para cuando cambian los documentos)."""

    def __init__(self, uow_factory: UnitOfWorkFactory, policy: TermsPolicy, clock: Clock) -> None:
        self._uow_factory = uow_factory
        self._policy = policy
        self._clock = clock

    async def __call__(
        self, user_id: UUID, document: TermsDocument, version: str, ip_address: str | None
    ) -> ProfileView:
        if self._policy.versions.get(document) != version:
            raise TermsVersionMismatch()

        async with self._uow_factory() as uow:
            user = await _load(uow, user_id)
            if not await uow.terms.has_accepted(user_id, document, version):
                await uow.terms.add(
                    TermsAcceptance.create(
                        user_id=user_id,
                        document=document,
                        version=version,
                        accepted_at=self._clock.now(),
                        ip_address=ip_address,
                    )
                )
                await uow.commit()
            must_accept = not await has_accepted_current_terms(uow, user_id, self._policy)
        return ProfileView(user, must_accept)
