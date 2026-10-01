from uuid import UUID

from neirapp.modules.identity.application.app import IdentityApp
from neirapp.modules.identity.domain.entities import Role


class IdentityAccessAdapter:
    """Implementa `AccessPort` sobre la fachada pública de `identity`."""

    def __init__(self, identity: IdentityApp) -> None:
        self._identity = identity

    async def professional_ids(self) -> set[UUID]:
        return await self._identity.list_user_ids_with_role(Role.PROFESSIONAL)
