from datetime import datetime
from uuid import UUID

from sqlalchemy import delete, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from neirapp.modules.identity.domain.entities import (
    RefreshToken,
    Role,
    RoleGrant,
    TermsAcceptance,
    TermsDocument,
    User,
)
from neirapp.modules.identity.domain.errors import EmailAlreadyRegistered
from neirapp.modules.identity.infrastructure.models import (
    RefreshTokenModel,
    RoleGrantModel,
    TermsAcceptanceModel,
    UserModel,
    UserRoleModel,
)


def _to_user(model: UserModel) -> User:
    return User(
        id=model.id,
        email=model.email,
        password_hash=model.password_hash,
        full_name=model.full_name,
        phone=model.phone,
        created_at=model.created_at,
        roles={Role(r.role) for r in model.roles},
        is_active=model.is_active,
    )


class SqlAlchemyUserRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, user: User) -> None:
        self._session.add(
            UserModel(
                id=user.id,
                email=user.email,
                password_hash=user.password_hash,
                full_name=user.full_name,
                phone=user.phone,
                is_active=user.is_active,
                created_at=user.created_at,
                roles=[UserRoleModel(user_id=user.id, role=r.value) for r in user.roles],
            )
        )
        try:
            await self._session.flush()
        except IntegrityError as exc:  # carrera entre dos registros con el mismo correo
            raise EmailAlreadyRegistered() from exc

    async def get(self, user_id: UUID) -> User | None:
        model = await self._session.get(UserModel, user_id)
        return _to_user(model) if model else None

    async def get_by_email(self, email: str) -> User | None:
        result = await self._session.execute(select(UserModel).where(UserModel.email == email))
        model = result.scalar_one_or_none()
        return _to_user(model) if model else None

    async def update(self, user: User) -> None:
        model = await self._session.get(UserModel, user.id)
        if model is None:
            raise LookupError(f"Usuario {user.id} no existe")
        model.full_name = user.full_name
        model.phone = user.phone
        model.password_hash = user.password_hash
        model.is_active = user.is_active

        current = {r.role for r in model.roles}
        wanted = {r.value for r in user.roles}
        model.roles = [r for r in model.roles if r.role in wanted]
        model.roles.extend(UserRoleModel(user_id=user.id, role=r) for r in sorted(wanted - current))
        await self._session.flush()

    async def ids_with_role(self, role: Role) -> set[UUID]:
        result = await self._session.execute(
            select(UserRoleModel.user_id)
            .join(UserModel, UserModel.id == UserRoleModel.user_id)
            .where(UserRoleModel.role == role.value, UserModel.is_active.is_(True))
        )
        return set(result.scalars())


class SqlAlchemyTermsRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, acceptance: TermsAcceptance) -> None:
        self._session.add(
            TermsAcceptanceModel(
                id=acceptance.id,
                user_id=acceptance.user_id,
                document=acceptance.document.value,
                version=acceptance.version,
                accepted_at=acceptance.accepted_at,
                ip_address=acceptance.ip_address,
            )
        )
        await self._session.flush()

    async def has_accepted(self, user_id: UUID, document: TermsDocument, version: str) -> bool:
        result = await self._session.execute(
            select(TermsAcceptanceModel.id)
            .where(
                TermsAcceptanceModel.user_id == user_id,
                TermsAcceptanceModel.document == document.value,
                TermsAcceptanceModel.version == version,
            )
            .limit(1)
        )
        return result.first() is not None


class SqlAlchemyRefreshTokenRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, token: RefreshToken) -> None:
        self._session.add(
            RefreshTokenModel(
                id=token.id,
                user_id=token.user_id,
                family_id=token.family_id,
                token_hash=token.token_hash,
                created_at=token.created_at,
                expires_at=token.expires_at,
                revoked_at=token.revoked_at,
            )
        )
        await self._session.flush()

    async def get_by_hash(self, token_hash: str) -> RefreshToken | None:
        result = await self._session.execute(
            select(RefreshTokenModel).where(RefreshTokenModel.token_hash == token_hash)
        )
        model = result.scalar_one_or_none()
        if model is None:
            return None
        return RefreshToken(
            id=model.id,
            user_id=model.user_id,
            family_id=model.family_id,
            token_hash=model.token_hash,
            created_at=model.created_at,
            expires_at=model.expires_at,
            revoked_at=model.revoked_at,
        )

    async def update(self, token: RefreshToken) -> None:
        await self._session.execute(
            update(RefreshTokenModel)
            .where(RefreshTokenModel.id == token.id)
            .values(revoked_at=token.revoked_at)
        )

    async def revoke_family(self, family_id: UUID, now: datetime) -> None:
        await self._session.execute(
            update(RefreshTokenModel)
            .where(RefreshTokenModel.family_id == family_id, RefreshTokenModel.revoked_at.is_(None))
            .values(revoked_at=now)
        )


def _to_grant(model: RoleGrantModel) -> RoleGrant:
    return RoleGrant(
        email=model.email,
        role=Role(model.role),
        granted_by=model.granted_by,
        created_at=model.created_at,
    )


class SqlAlchemyRoleGrantRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def add(self, grant: RoleGrant) -> None:
        if await self._session.get(RoleGrantModel, (grant.email, grant.role.value)) is not None:
            return
        self._session.add(
            RoleGrantModel(
                email=grant.email,
                role=grant.role.value,
                granted_by=grant.granted_by,
                created_at=grant.created_at,
            )
        )
        await self._session.flush()

    async def remove(self, email: str, role: Role) -> bool:
        result = await self._session.execute(
            delete(RoleGrantModel).where(
                RoleGrantModel.email == email, RoleGrantModel.role == role.value
            )
        )
        return bool(result.rowcount)  # type: ignore[attr-defined]

    async def list_all(self) -> list[RoleGrant]:
        result = await self._session.execute(
            select(RoleGrantModel).order_by(RoleGrantModel.created_at.desc(), RoleGrantModel.email)
        )
        return [_to_grant(m) for m in result.scalars()]

    async def list_for_email(self, email: str) -> list[RoleGrant]:
        result = await self._session.execute(
            select(RoleGrantModel).where(RoleGrantModel.email == email)
        )
        return [_to_grant(m) for m in result.scalars()]
