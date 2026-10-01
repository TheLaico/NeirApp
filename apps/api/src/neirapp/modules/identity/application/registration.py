from dataclasses import dataclass

from neirapp.modules.identity.application.dto import AuthenticatedSession, ProfileView, TermsPolicy
from neirapp.modules.identity.application.ports import PasswordHasher, UnitOfWorkFactory
from neirapp.modules.identity.application.session_issuer import SessionIssuer
from neirapp.modules.identity.domain.entities import TermsAcceptance, User
from neirapp.modules.identity.domain.errors import EmailAlreadyRegistered, TermsNotAccepted
from neirapp.modules.identity.domain.value_objects import normalize_email, validate_password
from neirapp.shared.application.ports import Clock


@dataclass(frozen=True)
class RegisterUserCommand:
    email: str
    password: str
    full_name: str
    phone: str
    accepted_terms: bool
    ip_address: str | None = None


class RegisterUser:
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

    async def __call__(self, cmd: RegisterUserCommand) -> AuthenticatedSession:
        if not cmd.accepted_terms:
            raise TermsNotAccepted()
        email = normalize_email(cmd.email)
        validate_password(cmd.password)

        now = self._clock.now()
        user = User.register(
            email=email,
            password_hash=await self._hasher.hash(cmd.password),
            full_name=cmd.full_name,
            phone=cmd.phone,
            now=now,
        )

        async with self._uow_factory() as uow:
            if await uow.users.get_by_email(email) is not None:
                raise EmailAlreadyRegistered()
            for grant in await uow.role_grants.list_for_email(email):
                user.grant_role(grant.role)
            await uow.users.add(user)
            for document, version in self._policy.versions.items():
                await uow.terms.add(
                    TermsAcceptance.create(
                        user_id=user.id,
                        document=document,
                        version=version,
                        accepted_at=now,
                        ip_address=cmd.ip_address,
                    )
                )
            tokens = await self._sessions.issue(uow, user, now)
            await uow.commit()

        return AuthenticatedSession(ProfileView(user, must_accept_terms=False), tokens)
