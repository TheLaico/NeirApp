from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

from neirapp.modules.leads.domain.entities import MerchantLead
from neirapp.modules.leads.infrastructure.models import MerchantLeadModel


def _to_lead(model: MerchantLeadModel) -> MerchantLead:
    return MerchantLead(
        id=model.id,
        user_id=model.user_id,
        contact_name=model.contact_name,
        business_name=model.business_name,
        phone=model.phone,
        created_at=model.created_at,
        is_contacted=model.is_contacted,
    )


class SqlAlchemyLeadStore:
    def __init__(self, session_factory: async_sessionmaker[Any]) -> None:
        self._session_factory = session_factory

    async def add(self, lead: MerchantLead) -> None:
        async with self._session_factory() as session:
            session.add(
                MerchantLeadModel(
                    id=lead.id,
                    user_id=lead.user_id,
                    contact_name=lead.contact_name,
                    business_name=lead.business_name,
                    phone=lead.phone,
                    is_contacted=lead.is_contacted,
                    created_at=lead.created_at,
                )
            )
            await session.commit()

    async def list_all(self) -> list[MerchantLead]:
        async with self._session_factory() as session:
            result = await session.execute(
                select(MerchantLeadModel).order_by(MerchantLeadModel.created_at.desc())
            )
            return [_to_lead(m) for m in result.scalars()]

    async def set_contacted(self, lead_id: UUID, is_contacted: bool) -> MerchantLead | None:
        async with self._session_factory() as session:
            model = await session.get(MerchantLeadModel, lead_id)
            if model is None:
                return None
            model.is_contacted = is_contacted
            await session.commit()
            return _to_lead(model)
