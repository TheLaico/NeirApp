from uuid import UUID

from neirapp.modules.professionals.application.ports import AccessPort, GalleryRepository
from neirapp.modules.professionals.domain.errors import (
    GalleryImageNotFound,
    InvalidGalleryOrder,
    ProfileNotFound,
    TooManyImages,
)
from neirapp.modules.professionals.domain.gallery import MAX_IMAGES, GalleryImage, clean_caption
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
    """Agrega al final una foto ya subida (`POST /uploads/images`)."""

    def __init__(self, repo: GalleryRepository, clock: Clock) -> None:
        self._repo = repo
        self._clock = clock

    async def __call__(self, user_id: UUID, url: str, caption: str) -> GalleryImage:
        existing = await self._repo.list_for(user_id)
        if len(existing) >= MAX_IMAGES:
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
    """Fotos de un profesional que sigue autorizado (para su página "Ver perfil")."""

    def __init__(self, repo: GalleryRepository, access: AccessPort) -> None:
        self._repo = repo
        self._access = access

    async def __call__(self, user_id: UUID) -> list[GalleryImage]:
        if user_id not in await self._access.professional_ids():
            raise ProfileNotFound("Perfil no encontrado.")
        return await self._repo.list_for(user_id)
