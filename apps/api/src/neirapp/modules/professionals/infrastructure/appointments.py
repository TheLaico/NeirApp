from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

from neirapp.modules.professionals.domain.appointments import (
    AppointmentRequest,
    Modality,
    RequestStatus,
    TimeSlot,
)
from neirapp.modules.professionals.infrastructure.models import AppointmentRequestModel

_FIELDS = (
    "professional_id",
    "customer_id",
    "customer_name",
    "customer_phone",
    "preferred_date",
    "message",
    "address",
    "service_id",
    "service_name",
    "scheduled_at",
    "note",
    "cancelled_by_customer",
    "created_at",
    "updated_at",
)


def _to_domain(m: AppointmentRequestModel) -> AppointmentRequest:
    return AppointmentRequest(
        id=m.id,
        modality=Modality(m.modality),
        preferred_time=TimeSlot(m.preferred_time),
        status=RequestStatus(m.status),
        **{name: getattr(m, name) for name in _FIELDS},
    )


class SqlAlchemyAppointmentRepository:
    def __init__(self, session_factory: async_sessionmaker[Any]) -> None:
        self._session_factory = session_factory

    async def _list(self, *where: Any) -> list[AppointmentRequest]:
        async with self._session_factory() as session:
            result = await session.execute(
                select(AppointmentRequestModel)
                .where(*where)
                .order_by(AppointmentRequestModel.created_at.desc())
            )
            return [_to_domain(m) for m in result.scalars()]

    async def list_for_professional(self, professional_id: UUID) -> list[AppointmentRequest]:
        return await self._list(AppointmentRequestModel.professional_id == professional_id)

    async def list_for_customer(self, customer_id: UUID) -> list[AppointmentRequest]:
        return await self._list(AppointmentRequestModel.customer_id == customer_id)

    async def get(self, request_id: UUID) -> AppointmentRequest | None:
        async with self._session_factory() as session:
            model = await session.get(AppointmentRequestModel, request_id)
            return _to_domain(model) if model else None

    async def save(self, request: AppointmentRequest) -> None:
        async with self._session_factory() as session:
            model = await session.get(AppointmentRequestModel, request.id)
            if model is None:
                model = AppointmentRequestModel(id=request.id)
                session.add(model)
            for name in _FIELDS:
                setattr(model, name, getattr(request, name))
            model.modality = request.modality.value
            model.preferred_time = request.preferred_time.value
            model.status = request.status.value
            await session.commit()
