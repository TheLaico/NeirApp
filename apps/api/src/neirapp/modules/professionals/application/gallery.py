from uuid import UUID

from neirapp.modules.professionals.application.plans import PlanBook
from neirapp.modules.professionals.application.ports import GalleryRepository
from neirapp.modules.professionals.domain.errors import (
    GalleryImageNotFound,
    InvalidGalleryOrder,
    ProfileNotFound,
    TooManyImages,
)
from neirapp.modules.professionals.domain.gallery import GalleryImage, clean_caption
from neirapp.modules.professionals.domain.plans import NO_PLAN_MAX_IMAGES
from neirapp.shared.application.ports import Clock


async def _own(repo: GalleryRepository, user_id: UUID, image_id: UUID) -> GalleryImage:
    # Una foto de otro profesional se trata como inexistente: no se revela que existe.
    image = await repo.get(image_id)
    if image is None or image.user_id != user_id:
        raise GalleryImageNotFound()
    return image


class ListMyGallery:
    def __init__(self, repo: GalleryRepository) -> None:
        self._repo = repo

    async def __call__(self, user_id: UUID) -> list[GalleryImage]:
        return await self._repo.list_for(user_id)


class AddGalleryImage:
    """Agrega al final una foto ya subida (`POST /uploads/images`), hasta el máximo de su plan."""

    def __init__(self, repo: GalleryRepository, plans: PlanBook, clock: Clock) -> None:
        self._repo = repo
        self._plans = plans
        self._clock = clock

    async def __call__(self, user_id: UUID, url: str, caption: str) -> GalleryImage:
        existing = await self._repo.list_for(user_id)
        plan = await self._plans.of(user_id)
        if len(existing) >= (plan.max_images if plan else NO_PLAN_MAX_IMAGES):
            raise TooManyImages()
        position = max((i.position for i in existing), default=-1) + 1
        image = GalleryImage.create(user_id, url, caption, position, self._clock.now())
        await self._repo.save(image)
        return image


class SetGalleryCaption:
    def __init__(self, repo: GalleryRepository) -> None:
        self._repo = repo

    async def __call__(self, user_id: UUID, image_id: UUID, caption: str) -> GalleryImage:
        image = await _own(self._repo, user_id, image_id)
        image.caption = clean_caption(caption)
        await self._repo.save(image)
        return image


class ReorderGallery:
    """Recibe todos los ids en el orden nuevo; el primero queda como portada."""

    def __init__(self, repo: GalleryRepository) -> None:
        self._repo = repo

    async def __call__(self, user_id: UUID, ordered_ids: list[UUID]) -> list[GalleryImage]:
        current = await self._repo.list_for(user_id)
        if len(ordered_ids) != len(set(ordered_ids)) or set(ordered_ids) != {i.id for i in current}:
            raise InvalidGalleryOrder()
        await self._repo.set_positions({image_id: n for n, image_id in enumerate(ordered_ids)})
        return await self._repo.list_for(user_id)


class DeleteGalleryImage:
    def __init__(self, repo: GalleryRepository) -> None:
        self._repo = repo

    async def __call__(self, user_id: UUID, image_id: UUID) -> None:
        await _own(self._repo, user_id, image_id)
        await self._repo.delete(image_id)


class ListPublicGallery:
    """Fotos de un profesional publicado (para su página "Ver perfil"). Si bajó de plan, se
    muestran las primeras que le permite el plan actual; las demás siguen guardadas."""

    def __init__(self, repo: GalleryRepository, plans: PlanBook) -> None:
        self._repo = repo
        self._plans = plans

    async def __call__(self, user_id: UUID) -> list[GalleryImage]:
        plan = await self._plans.public(user_id)
        if plan is None:
            raise ProfileNotFound("Perfil no encontrado.")
        return (await self._repo.list_for(user_id))[: plan.max_images]
