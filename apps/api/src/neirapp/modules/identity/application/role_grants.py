from dataclasses import dataclass
from uuid import UUID

from neirapp.modules.identity.application.ports import UnitOfWorkFactory
from neirapp.modules.identity.domain.entities import ASSIGNABLE_ROLES, Role, RoleGrant, User
from neirapp.modules.identity.domain.errors import RoleNotAssignable
from neirapp.modules.identity.domain.value_objects import normalize_email
from neirapp.shared.application.ports import Clock


@dataclass(frozen=True)
class RoleGrantView:
    grant: RoleGrant
    full_name: str | None  # None mientras el correo no se haya registrado


def _check_assignable(role: Role) -> None:
    if role not in ASSIGNABLE_ROLES:
        raise RoleNotAssignable()


class GrantRoleByEmail:
    """Autoriza un correo para un rol: la cuenta existente lo recibe ya; si no, al registrarse."""

    def __init__(self, uow_factory: UnitOfWorkFactory, clock: Clock) -> None:
        self._uow_factory = uow_factory
        self._clock = clock

    async def __call__(self, admin_id: UUID, email: str, role: Role) -> RoleGrantView:
        _check_assignable(role)
        email = normalize_email(email)
        grant = RoleGrant(email=email, role=role, granted_by=admin_id, created_at=self._clock.now())
        async with self._uow_factory() as uow:
            await uow.role_grants.add(grant)
            user = await uow.users.get_by_email(email)
            if user is not None:
                user.grant_role(role)
                await uow.users.update(user)
            await uow.commit()
        return RoleGrantView(grant, user.full_name if user else None)


class RevokeRoleGrant:
    """Quita la autorización y el rol al usuario. Su access token actual vale hasta que expire."""

    def __init__(self, uow_factory: UnitOfWorkFactory) -> None:
        self._uow_factory = uow_factory

    async def __call__(self, email: str, role: Role) -> None:
        _check_assignable(role)
        email = normalize_email(email)
        async with self._uow_factory() as uow:
            await uow.role_grants.remove(email, role)
            user = await uow.users.get_by_email(email)
            if user is not None:
                user.revoke_role(role)
                await uow.users.update(user)
            await uow.commit()


class ListRoleGrants:
    def __init__(self, uow_factory: UnitOfWorkFactory) -> None:
        self._uow_factory = uow_factory

    async def __call__(self) -> list[RoleGrantView]:
        async with self._uow_factory() as uow:
            views = []
            for grant in await uow.role_grants.list_all():
                user = await uow.users.get_by_email(grant.email)
                views.append(RoleGrantView(grant, user.full_name if user else None))
        return views


class FindUserByEmail:
    """Busca una cuenta por correo. Solo para uso de administradores (ver rutas de `stores`)."""

    def __init__(self, uow_factory: UnitOfWorkFactory) -> None:
        self._uow_factory = uow_factory

    async def __call__(self, email: str) -> User | None:
        email = normalize_email(email)
        async with self._uow_factory() as uow:
            return await uow.users.get_by_email(email)


class ListUserIdsWithRole:
    """Cuentas activas con un rol. Otros módulos la usan para saber quién sigue autorizado."""

    def __init__(self, uow_factory: UnitOfWorkFactory) -> None:
        self._uow_factory = uow_factory

    async def __call__(self, role: Role) -> set[UUID]:
        async with self._uow_factory() as uow:
            return await uow.users.ids_with_role(role)
