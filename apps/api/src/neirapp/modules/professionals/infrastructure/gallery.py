from typing import Any
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import async_sessionmaker

from neirapp.modules.professionals.domain.gallery import GalleryImage
from neirapp.modules.professionals.infrastructure.models import GalleryImageModel


def _to_domain(m: GalleryImageModel) -> GalleryImage:
    return GalleryImage(
        id=m.id,
        user_id=m.user_id,
        url=m.url,
        caption=m.caption,
        position=m.position,
        created_at=m.created_at,
    )


class SqlAlchemyGalleryRepository:
    def __init__(self, session_factory: async_sessionmaker[Any]) -> None:
        self._session_factory = session_factory

    async def list_for(self, user_id: UUID) -> list[GalleryImage]:
        async with self._session_factory() as session:
            result = await session.execute(
                select(GalleryImageModel)
                .where(GalleryImageModel.user_id == user_id)
                .order_by(GalleryImageModel.position, GalleryImageModel.created_at)
            )
            return [_to_domain(m) for m in result.scalars()]

    async def get(self, image_id: UUID) -> GalleryImage | None:
        async with self._session_factory() as session:
            model = await session.get(GalleryImageModel, image_id)
            return _to_domain(model) if model else None

    async def save(self, image: GalleryImage) -> None:
        async with self._session_factory() as session:
            model = await session.get(GalleryImageModel, image.id)
            if model is None:
                model = GalleryImageModel(id=image.id)
                session.add(model)
            model.user_id = image.user_id
            model.url = image.url
            model.caption = image.caption
            model.position = image.position
            model.created_at = image.created_at
            await session.commit()

    async def set_positions(self, positions: dict[UUID, int]) -> None:
        async with self._session_factory() as session:
            result = await session.execute(
                select(GalleryImageModel).where(GalleryImageModel.id.in_(positions))
            )
            for model in result.scalars():
                model.position = positions[model.id]
            await session.commit()

    async def delete(self, image_id: UUID) -> None:
        async with self._session_factory() as session:
            await session.execute(delete(GalleryImageModel).where(GalleryImageModel.id == image_id))
            await session.commit()
