from dataclasses import dataclass
from uuid import UUID

from neirapp.modules.professionals.application.ports import AccessPort, ProfileRepository
from neirapp.modules.professionals.domain.entities import ProfessionalProfile, ProfileData
from neirapp.modules.professionals.domain.errors import ProfileNotFound
from neirapp.shared.application.ports import Clock


class GetMyProfile:
    def __init__(self, repo: ProfileRepository) -> None:
        self._repo = repo

    async def __call__(self, user_id: UUID) -> ProfessionalProfile:
        profile = await self._repo.get(user_id)
        if profile is None:
            raise ProfileNotFound()
        return profile


class SaveMyProfile:
    """Crea el perfil la primera vez y lo reemplaza las siguientes."""

    def __init__(self, repo: ProfileRepository, clock: Clock) -> None:
        self._repo = repo
        self._clock = clock

    async def __call__(self, user_id: UUID, data: ProfileData) -> ProfessionalProfile:
        now = self._clock.now()
        profile = await self._repo.get(user_id)
        if profile is None:
            profile = ProfessionalProfile.create(user_id, data, now)
        else:
            profile.update(data, now)
        await self._repo.save(profile)
        return profile


@dataclass(frozen=True)
class DirectoryFilter:
    category_id: str | None = None
    subcategory_id: str | None = None


def directory_order(profile: ProfessionalProfile) -> tuple[bool, bool, float]:
    # Destacados primero, luego los disponibles; dentro de cada grupo, el perfil actualizado más
    # recientemente (los que lo mantienen al día).
    return (not profile.is_featured, not profile.is_available, -profile.updated_at.timestamp())


class ListDirectory:
    """Perfiles que ven los clientes: solo de cuentas que siguen autorizadas como profesional."""

    def __init__(self, repo: ProfileRepository, access: AccessPort) -> None:
        self._repo = repo
        self._access = access

    async def __call__(self, flt: DirectoryFilter) -> list[ProfessionalProfile]:
        allowed = await self._access.professional_ids()
        profiles = [
            p
            for p in await self._repo.list_all()
            if p.user_id in allowed
            and (not flt.category_id or p.category_id == flt.category_id)
            and (not flt.subcategory_id or p.subcategory_id == flt.subcategory_id)
        ]
        return sorted(profiles, key=directory_order)


class GetPublicProfile:
    def __init__(self, repo: ProfileRepository, access: AccessPort) -> None:
        self._repo = repo
        self._access = access

    async def __call__(self, user_id: UUID) -> ProfessionalProfile:
        profile = await self._repo.get(user_id)
        if profile is None or user_id not in await self._access.professional_ids():
            raise ProfileNotFound("Perfil no encontrado.")
        return profile


class SetFeatured:
    """El administrador destaca (o deja de destacar) a un profesional."""

    def __init__(self, repo: ProfileRepository) -> None:
        self._repo = repo

    async def __call__(self, user_id: UUID, *, is_featured: bool) -> ProfessionalProfile:
        profile = await self._repo.get(user_id)
        if profile is None:
            raise ProfileNotFound("Perfil no encontrado.")
        profile.is_featured = is_featured
        await self._repo.save(profile)
        return profile
