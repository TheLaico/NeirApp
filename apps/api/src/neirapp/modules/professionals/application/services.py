from uuid import UUID

from neirapp.modules.professionals.application.ports import AccessPort, ServiceRepository
from neirapp.modules.professionals.domain.errors import (
    ProfileNotFound,
    ServiceNotFound,
    TooManyServices,
)
from neirapp.modules.professionals.domain.services import (
    MAX_SERVICES,
    ProfessionalService,
    ServiceData,
)
from neirapp.shared.application.ports import Clock


async def _own(repo: ServiceRepository, user_id: UUID, service_id: UUID) -> ProfessionalService:
    # Un servicio de otro profesional se trata como inexistente: no se revela que existe.
    service = await repo.get(service_id)
    if service is None or service.user_id != user_id:
        raise ServiceNotFound()
    return service


class ListMyServices:
    def __init__(self, repo: ServiceRepository) -> None:
        self._repo = repo

    async def __call__(self, user_id: UUID) -> list[ProfessionalService]:
        return await self._repo.list_for(user_id)


class AddService:
    def __init__(self, repo: ServiceRepository, clock: Clock) -> None:
        self._repo = repo
        self._clock = clock

    async def __call__(self, user_id: UUID, data: ServiceData) -> ProfessionalService:
        existing = await self._repo.list_for(user_id)
        if len(existing) >= MAX_SERVICES:
            raise TooManyServices()
        position = max((s.position for s in existing), default=-1) + 1
        service = ProfessionalService.create(user_id, data, position, self._clock.now())
        await self._repo.save(service)
        return service


class UpdateService:
    def __init__(self, repo: ServiceRepository, clock: Clock) -> None:
        self._repo = repo
        self._clock = clock

    async def __call__(
        self, user_id: UUID, service_id: UUID, data: ServiceData
    ) -> ProfessionalService:
        service = await _own(self._repo, user_id, service_id)
        service.update(data, self._clock.now())
        await self._repo.save(service)
        return service


class DeleteService:
    def __init__(self, repo: ServiceRepository) -> None:
        self._repo = repo

    async def __call__(self, user_id: UUID, service_id: UUID) -> None:
        await _own(self._repo, user_id, service_id)
        await self._repo.delete(service_id)


class ListPublicServices:
    """Servicios visibles de un profesional que sigue autorizado (para su página "Ver perfil")."""

    def __init__(self, repo: ServiceRepository, access: AccessPort) -> None:
        self._repo = repo
        self._access = access

    async def __call__(self, user_id: UUID) -> list[ProfessionalService]:
        if user_id not in await self._access.professional_ids():
            raise ProfileNotFound("Perfil no encontrado.")
        return [s for s in await self._repo.list_for(user_id) if s.is_active]
