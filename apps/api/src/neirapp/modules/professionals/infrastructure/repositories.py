from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

from neirapp.modules.professionals.domain.entities import Modalities, ProfessionalProfile
from neirapp.modules.professionals.infrastructure.models import ProfessionalProfileModel

_FIELDS = (
    "title",
    "full_name",
    "headline",
    "category_id",
    "subcategory_id",
    "experience_years",
    "description",
    "phone",
    "whatsapp",
    "email",
    "address",
    "schedule",
    "is_available",
    "photo_url",
    "is_featured",
    "is_listed",
    "created_at",
    "updated_at",
)


def _to_domain(model: ProfessionalProfileModel) -> ProfessionalProfile:
    return ProfessionalProfile(
        user_id=model.user_id,
        modalities=Modalities(
            office=model.attends_office, home=model.attends_home, online=model.attends_online
        ),
        **{name: getattr(model, name) for name in _FIELDS},
    )


class SqlAlchemyProfileRepository:
    def __init__(self, session_factory: async_sessionmaker[Any]) -> None:
        self._session_factory = session_factory

    async def get(self, user_id: UUID) -> ProfessionalProfile | None:
        async with self._session_factory() as session:
            model = await session.get(ProfessionalProfileModel, user_id)
            return _to_domain(model) if model else None

    async def save(self, profile: ProfessionalProfile) -> None:
        async with self._session_factory() as session:
            model = await session.get(ProfessionalProfileModel, profile.user_id)
            if model is None:
                model = ProfessionalProfileModel(user_id=profile.user_id)
                session.add(model)
            for name in _FIELDS:
                setattr(model, name, getattr(profile, name))
            model.attends_office = profile.modalities.office
            model.attends_home = profile.modalities.home
            model.attends_online = profile.modalities.online
            await session.commit()

    async def list_all(self) -> list[ProfessionalProfile]:
        async with self._session_factory() as session:
            result = await session.execute(select(ProfessionalProfileModel))
            return [_to_domain(m) for m in result.scalars()]
