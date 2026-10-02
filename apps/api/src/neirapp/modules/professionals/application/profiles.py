from dataclasses import dataclass
from uuid import UUID

from neirapp.modules.professionals.application.plans import PlanBook
from neirapp.modules.professionals.application.ports import (
    CategoryRepository,
    ProfileRepository,
)
from neirapp.modules.professionals.domain.entities import ProfessionalProfile, ProfileData
from neirapp.modules.professionals.domain.errors import InvalidCategory, ProfileNotFound
from neirapp.modules.professionals.domain.plans import PlanSpec
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

    def __init__(
        self, repo: ProfileRepository, categories: CategoryRepository, clock: Clock
    ) -> None:
        self._repo = repo
        self._categories = categories
        self._clock = clock

    async def __call__(self, user_id: UUID, data: ProfileData) -> ProfessionalProfile:
        # El área y la especialidad deben existir hoy en el catálogo que gestiona el admin.
        category = await self._categories.get(data.category_id.strip())
        sub_id = data.subcategory_id.strip()
        if category is None or (sub_id and category.find(sub_id) is None):
            raise InvalidCategory()
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


@dataclass(frozen=True)
class PublishedProfile:
    """Un perfil que ven los clientes, con el plan con el que se publica."""

    profile: ProfessionalProfile
    plan: PlanSpec

    @property
    def is_featured(self) -> bool:
        # Lo destaca el administrador o lo incluye su plan (Premium).
        return self.profile.is_featured or self.plan.featured


def directory_order(item: PublishedProfile) -> tuple[bool, bool, float]:
    # Destacados primero, luego los disponibles; dentro de cada grupo, el perfil actualizado más
    # recientemente (los que lo mantienen al día).
    p = item.profile
    return (not item.is_featured, not p.is_available, -p.updated_at.timestamp())


class ListDirectory:
    """Perfiles que ven los clientes: cuentas que siguen autorizadas como profesional, con un
    plan vigente y que no ocultaron su perfil."""

    def __init__(self, repo: ProfileRepository, plans: PlanBook) -> None:
        self._repo = repo
        self._plans = plans

    async def __call__(self, flt: DirectoryFilter) -> list[PublishedProfile]:
        plans = await self._plans.all_public()
        items = [
            PublishedProfile(p, plans[p.user_id])
            for p in await self._repo.list_all()
            if p.user_id in plans
            and p.is_listed
            and (not flt.category_id or p.category_id == flt.category_id)
            and (not flt.subcategory_id or p.subcategory_id == flt.subcategory_id)
        ]
        return sorted(items, key=directory_order)


class GetPublicProfile:
    def __init__(self, repo: ProfileRepository, plans: PlanBook) -> None:
        self._repo = repo
        self._plans = plans

    async def __call__(self, user_id: UUID) -> PublishedProfile:
        profile = await self._repo.get(user_id)
        plan = await self._plans.public(user_id) if profile and profile.is_listed else None
        if profile is None or plan is None:
            raise ProfileNotFound("Perfil no encontrado.")
        return PublishedProfile(profile, plan)


class UpdateMySettings:
    """Configuración del profesional: mostrar u ocultar su perfil y aceptar o pausar solicitudes.
    No cambia la fecha de actualización (no es un cambio del contenido del perfil)."""

    def __init__(self, repo: ProfileRepository) -> None:
        self._repo = repo

    async def __call__(
        self, user_id: UUID, *, is_listed: bool, accepts_requests: bool
    ) -> ProfessionalProfile:
        profile = await self._repo.get(user_id)
        if profile is None:
            raise ProfileNotFound()
        profile.is_listed = is_listed
        profile.accepts_requests = accepts_requests
        await self._repo.save(profile)
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
