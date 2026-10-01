from typing import Any
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import async_sessionmaker

from neirapp.modules.professionals.domain.services import PriceKind, ProfessionalService
from neirapp.modules.professionals.infrastructure.models import ServiceModel

_FIELDS = (
    "user_id",
    "name",
    "description",
    "price_cop",
    "duration_minutes",
    "is_active",
    "position",
    "created_at",
    "updated_at",
)


def _to_domain(model: ServiceModel) -> ProfessionalService:
    return ProfessionalService(
        id=model.id,
        price_kind=PriceKind(model.price_kind),
        **{name: getattr(model, name) for name in _FIELDS},
    )


class SqlAlchemyServiceRepository:
    def __init__(self, session_factory: async_sessionmaker[Any]) -> None:
        self._session_factory = session_factory

    async def list_for(self, user_id: UUID) -> list[ProfessionalService]:
        async with self._session_factory() as session:
            result = await session.execute(
                select(ServiceModel)
                .where(ServiceModel.user_id == user_id)
                .order_by(ServiceModel.position)
            )
            return [_to_domain(m) for m in result.scalars()]

    async def get(self, service_id: UUID) -> ProfessionalService | None:
        async with self._session_factory() as session:
            model = await session.get(ServiceModel, service_id)
            return _to_domain(model) if model else None

    async def save(self, service: ProfessionalService) -> None:
        async with self._session_factory() as session:
            model = await session.get(ServiceModel, service.id)
            if model is None:
                model = ServiceModel(id=service.id)
                session.add(model)
            for name in _FIELDS:
                setattr(model, name, getattr(service, name))
            model.price_kind = service.price_kind.value
            await session.commit()

    async def delete(self, service_id: UUID) -> None:
        async with self._session_factory() as session:
            await session.execute(delete(ServiceModel).where(ServiceModel.id == service_id))
            await session.commit()
