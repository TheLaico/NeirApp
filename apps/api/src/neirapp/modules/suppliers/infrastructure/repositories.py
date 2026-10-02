from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

from neirapp.modules.suppliers.domain.entities import Supplier, SupplierCategory
from neirapp.modules.suppliers.infrastructure.models import SupplierModel

_FIELDS = (
    "company_name",
    "tagline",
    "description",
    "phone",
    "whatsapp",
    "email",
    "address",
    "website",
    "facebook",
    "instagram",
    "logo_url",
    "cover_url",
    "catalog_url",
    "is_listed",
    "created_at",
    "updated_at",
)


def _to_domain(m: SupplierModel) -> Supplier:
    return Supplier(
        user_id=m.user_id,
        category=SupplierCategory(m.category),
        **{name: getattr(m, name) for name in _FIELDS},
    )


class SqlAlchemySupplierRepository:
    def __init__(self, session_factory: async_sessionmaker[Any]) -> None:
        self._session_factory = session_factory

    async def get(self, user_id: UUID) -> Supplier | None:
        async with self._session_factory() as session:
            model = await session.get(SupplierModel, user_id)
            return _to_domain(model) if model else None

    async def save(self, supplier: Supplier) -> None:
        async with self._session_factory() as session:
            model = await session.get(SupplierModel, supplier.user_id)
            if model is None:
                model = SupplierModel(user_id=supplier.user_id)
                session.add(model)
            for name in _FIELDS:
                setattr(model, name, getattr(supplier, name))
            model.category = supplier.category.value
            await session.commit()

    async def list_all(self) -> list[Supplier]:
        async with self._session_factory() as session:
            result = await session.execute(
                select(SupplierModel).order_by(SupplierModel.updated_at.desc())
            )
            return [_to_domain(m) for m in result.scalars()]
