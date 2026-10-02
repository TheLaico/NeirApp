from uuid import UUID

from neirapp.modules.identity.application.app import IdentityApp
from neirapp.modules.identity.domain.entities import Role
from neirapp.modules.identity.domain.errors import UserNotFound
from neirapp.modules.marketplace.application.ports import Account


class IdentityAccountsAdapter:
    """Implementa `AccountsPort` sobre la fachada pública de `identity`."""

    def __init__(self, identity: IdentityApp) -> None:
        self._identity = identity

    async def account(self, user_id: UUID) -> Account | None:
        try:
            user = (await self._identity.get_profile(user_id)).user
        except UserNotFound:
            return None
        return Account(name=user.full_name, phone=user.phone)

    async def admin_ids(self) -> set[UUID]:
        return await self._identity.list_user_ids_with_role(Role.ADMIN)
