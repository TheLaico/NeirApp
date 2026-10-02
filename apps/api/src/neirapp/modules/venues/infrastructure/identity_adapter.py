from uuid import UUID

from neirapp.modules.identity.application.app import IdentityApp
from neirapp.modules.identity.domain.entities import Role


class IdentityAccessAdapter:
    """Implementa `AccessPort` sobre la fachada pública de `identity`."""

    def __init__(self, identity: IdentityApp) -> None:
        self._identity = identity

    async def venue_ids(self) -> set[UUID]:
        # Los administradores también: pueden armar un lugar (p. ej. desde la vista de desarrollo)
        # sin tener que autorizarse a sí mismos.
        venues = await self._identity.list_user_ids_with_role(Role.VENUE)
        return venues | await self._identity.list_user_ids_with_role(Role.ADMIN)
