from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

from neirapp.modules.leads.domain.applications import RoleApplication
from neirapp.modules.leads.domain.entities import MerchantLead
from neirapp.modules.leads.infrastructure.models import MerchantLeadModel, RoleApplicationModel


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


def _to_application(model: RoleApplicationModel) -> RoleApplication:
    return RoleApplication(
        id=model.id,
        role=model.role,
        full_name=model.full_name,
        document_number=model.document_number,
        phone=model.phone,
        email=model.email,
        company_name=model.company_name,
        company_id=model.company_id,
        details=dict(model.details or {}),
        message=model.message,
        created_at=model.created_at,
        is_contacted=model.is_contacted,
    )


class SqlAlchemyApplicationStore:
    def __init__(self, session_factory: async_sessionmaker[Any]) -> None:
        self._session_factory = session_factory

    async def add(self, application: RoleApplication) -> None:
        async with self._session_factory() as session:
            session.add(
                RoleApplicationModel(
                    id=application.id,
                    role=application.role,
                    full_name=application.full_name,
                    document_number=application.document_number,
                    phone=application.phone,
                    email=application.email,
                    company_name=application.company_name,
                    company_id=application.company_id,
                    details=application.details,
                    message=application.message,
                    is_contacted=application.is_contacted,
                    created_at=application.created_at,
                )
            )
            await session.commit()

    async def list_all(self) -> list[RoleApplication]:
        async with self._session_factory() as session:
            result = await session.execute(
                select(RoleApplicationModel).order_by(RoleApplicationModel.created_at.desc())
            )
            return [_to_application(m) for m in result.scalars()]

    async def set_contacted(
        self, application_id: UUID, is_contacted: bool
    ) -> RoleApplication | None:
        async with self._session_factory() as session:
            model = await session.get(RoleApplicationModel, application_id)
            if model is None:
                return None
            model.is_contacted = is_contacted
            await session.commit()
            return _to_application(model)
