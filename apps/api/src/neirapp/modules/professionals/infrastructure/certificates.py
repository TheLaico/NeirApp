from typing import Any
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import async_sessionmaker

from neirapp.modules.professionals.domain.certificates import (
    Certificate,
    CertificateKind,
    CertificateStatus,
)
from neirapp.modules.professionals.infrastructure.models import CertificateModel

_FIELDS = (
    "user_id",
    "title",
    "issuer",
    "year",
    "file_url",
    "show_on_profile",
    "review_note",
    "created_at",
    "updated_at",
    "reviewed_at",
)


def _to_domain(m: CertificateModel) -> Certificate:
    return Certificate(
        id=m.id,
        kind=CertificateKind(m.kind),
        status=CertificateStatus(m.status),
        **{name: getattr(m, name) for name in _FIELDS},
    )


class SqlAlchemyCertificateRepository:
    def __init__(self, session_factory: async_sessionmaker[Any]) -> None:
        self._session_factory = session_factory

    async def list_for(self, user_id: UUID) -> list[Certificate]:
        async with self._session_factory() as session:
            result = await session.execute(
                select(CertificateModel)
                .where(CertificateModel.user_id == user_id)
                .order_by(CertificateModel.created_at.desc())
            )
            return [_to_domain(m) for m in result.scalars()]

    async def list_pending(self) -> list[Certificate]:
        async with self._session_factory() as session:
            result = await session.execute(
                select(CertificateModel)
                .where(CertificateModel.status == CertificateStatus.PENDING.value)
                .order_by(CertificateModel.updated_at)
            )
            return [_to_domain(m) for m in result.scalars()]

    async def get(self, certificate_id: UUID) -> Certificate | None:
        async with self._session_factory() as session:
            model = await session.get(CertificateModel, certificate_id)
            return _to_domain(model) if model else None

    async def save(self, certificate: Certificate) -> None:
        async with self._session_factory() as session:
            model = await session.get(CertificateModel, certificate.id)
            if model is None:
                model = CertificateModel(id=certificate.id)
                session.add(model)
            for name in _FIELDS:
                setattr(model, name, getattr(certificate, name))
            model.kind = certificate.kind.value
            model.status = certificate.status.value
            await session.commit()

    async def delete(self, certificate_id: UUID) -> None:
        async with self._session_factory() as session:
            await session.execute(
                delete(CertificateModel).where(CertificateModel.id == certificate_id)
            )
            await session.commit()
