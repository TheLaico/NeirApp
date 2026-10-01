from typing import Protocol
from uuid import UUID

from neirapp.modules.professionals.domain.entities import ProfessionalProfile


class ProfileRepository(Protocol):
    async def get(self, user_id: UUID) -> ProfessionalProfile | None: ...

    async def save(self, profile: ProfessionalProfile) -> None:
        """Crea o reemplaza el perfil de esa cuenta."""
        ...

    async def list_all(self) -> list[ProfessionalProfile]: ...


class AccessPort(Protocol):
    """Quién tiene hoy acceso de profesional (el administrador puede quitarlo cuando quiera)."""

    async def professional_ids(self) -> set[UUID]: ...
